const MaxTokens = 2048;

/**
 * Answer the user question
 *
 * yao run scripts.qna.Answer "帮我对知识库中的内容按日期排序，整理成一个 Markdown 表格" 张三 371182ee-d76e-4680-a2b7-469cd1020041
 * yao run scripts.qna.Answer "仅整理PDF文档" 张三 d01e2b18-2d36-4ec3-9349-e55c6eab0c96
 * yao run scripts.qna.Answer "你好啊" 张三 371182ee-d76e-4680-a2b7-469cd1020041
 * yao run scripts.qna.Answer "给我一个 Markdown 格式文本, 不要代码" 张三 371182ee-d76e-4680-a2b7-469cd1020041
 * yao run scripts.qna.Answer "把上面的那个文本的路径也列出来" 张三 371182ee-d76e-4680-a2b7-469cd1020041
 *
 *
 * @param {*} sid
 * @param {*} question
 * @param {*} user
 */
function Answer(question, user, sid) {
  sid = sid || Process("utils.str.UUID");
  let history = getHistory(sid); // get the conversation history
  let docs = getDocs(question, history, user); // query the knowledge base
  let summaries = getSummaries(docs); // get the summaries of the knowledge base

  let messages = [];
  let size = 0;

  while (history.messages.length >= 0) {
    messages = [
      {
        role: "system",
        content: `
    - The above content is my knowledge base.
    - Please prioritize answering user questions based on my knowledge base provided to you.
    `,
      },
      ...history.messages,
      { role: "user", content: question },
    ];

    size = Process("scripts.openai.TokenSize", JSON.stringify(messages));
    if (size < MaxTokens - 1000) {
      break;
    }

    history.messages.shift();
    history.messages.shift();
  }

  // add the documents to the messages
  if (docs.length > 0) {
    messages = [
      { role: "system", content: JSON.stringify(docs[0]) },
      ...messages,
    ];

    size = Process("scripts.openai.TokenSize", JSON.stringify(messages));
  }

  // add the summary to the messages
  if (size < MaxTokens && summaries.length > 0) {
    messages = [
      { role: "system", content: JSON.stringify(summaries) },
      ...messages,
    ];

    size = Process("scripts.openai.TokenSize", JSON.stringify(messages));
  }

  // add more documents to the messages
  if (size < MaxTokens && docs.length > 1) {
    for (let i = 1; i < docs.length; i++) {
      messages = [
        { role: "system", content: JSON.stringify(docs[i]) },
        ...messages,
      ];

      size = Process("scripts.openai.TokenSize", JSON.stringify(messages));
      if (size >= MaxTokens) {
        break;
      }
    }
  }

  // send request
  let response = Process("scripts.openai.chat.Completions", messages, user);

  let choices = response.choices || [];
  if (choices.length < 1) {
    throw new Exception("answer error", 400);
  }

  // save history
  let message = choices[0].message || {};
  saveHistory(
    sid,
    [
      { role: "user", content: question },
      { role: "assistant", content: message.content },
    ],
    history
  );

  return { sid: sid, content: message.content };
}

// === utils =================================

/**
 * Save History by sid
 * @param {*} sid
 * @param {*} messages
 * @param {*} history
 */
function saveHistory(sid, messages, history) {
  let store = new Store("message");
  history.messages = [...history.messages, ...messages];
  history.TokenSize = Process(
    "scripts.openai.TokenSize",
    JSON.stringify(history.messages)
  );

  // expire in 2 hours
  store.Set(sid, history, 60 * 60 * 2);
}

/**
 * Get History by sid
 * @param {*} sid
 * @returns
 */
function getHistory(sid) {
  let store = new Store("message");
  let data = store.Get(sid) || { TokenSize: 0, messages: [] };
  return data;
}

/**
 * Get the docs from the knowledge base
 * @param {*} question
 * @param {*} history
 */
function getDocs(question, history, user) {
  history = history || { TokenSize: 0, messages: [] };
  let messages = [...history.messages, { role: "user", content: question }];
  return Process("scripts.vector.Query", JSON.stringify(messages), user);
}

/**
 * Get summaries from docs
 * @param {*} docs
 * @returns
 */
function getSummaries(docs) {
  docs = docs || [];
  let summaries = [];
  docs.forEach((doc) => {
    summaries.push({
      type: doc.type,
      path: doc.path,
      summary: doc.summary,
      url: doc.url,
      id: doc.id,
      lastUpdateTimeUnix: doc.lastUpdateTimeUnix,
    });
  });

  return summaries;
}