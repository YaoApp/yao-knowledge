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
function Answer(question) {
  let sid = Process("session.ID");
  let user = Process("session.Get", "user") || {};
  let messages = makeRequest(question, user.id, sid);

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

function AnswerStream(question) {
  let sid = Process("session.ID");
  let user = Process("session.Get", "user") || {};
  let messages = makeRequest(question, user.id, sid);

  let cfg = setting();
  let url = `${cfg.host}/v1/chat/completions`;
  let paylad = { model: cfg.model, messages: messages, user: sid };
  let content = "";

  return stream(url, paylad, cfg.key, (data) => {
    let response = data.slice(5);
    ssEvent("message", response);
    if (response == "") {
      // content = content + "\n";
      return 1;
    }
    try {
      let resData = JSON.parse(response);
      if (
        resData &&
        resData.choices &&
        resData.choices[0].delta &&
        resData.choices[0].delta.content
      ) {
        content = content + resData.choices[0].delta.content.replace(/\n/g, "");
      }
    } catch (error) {}

    if (data == "data: [DONE]") {
      let history = getHistory(sid);
      saveHistory(
        sid,
        [
          { role: "user", content: question },
          { role: "assistant", content: content },
        ],
        history
      );

      cancel();
      return 0;
    }
    return 1;
  });
}

/**
 * Document search api
 *
 * yao run scripts.qna.Search 我要写个PPT,帮我找点资料 1
 *
 * @param {*} question
 * @param {*} page
 * @returns
 */
function Search(question, page) {
  let user = Process("session.Get", "user") || {};
  return Process("scripts.vector.Search", question, page, user.id);
}

/**
 * Document find api
 *
 * yao run scripts.qna.Find e74838c6-99f6-4883-9f13-a74269557aa5
 *
 * @param {*} id
 * @returns
 */
function Find(id) {
  return Process("scripts.vector.Find", id);
}

// === utils =================================

function makeRequest(question, user, sid) {
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

  return messages;
}

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

/**
 * Post to openai data stream
 * @param {*} url
 * @param {*} payload
 * @param {*} key
 * @returns
 */
function stream(url, payload, key, cb) {
  payload["stream"] = true;
  let response = http.Stream("POST", url, cb, payload, null, {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json; charset=utf-8",
  });

  if (response.code != 200) {
    let data = response.data || {};
    let err = data.error || {};
    let message = err.message || "unknown error";
    log.Error(`OpenAI API error ${message}`);
    throw new Exception(`OpenAI API error ${message}`, response.code || 500);
  }

  return response.data;
}

/**
 * Get openai setting
 * @returns {Map}
 */
function setting() {
  let vars = Process(
    "utils.env.GetMany",
    "OPENAI_MODEL",
    "OPENAI_KEY",
    "OPENAI_PROXY",
    "OPENAI_MODEL_EMBEDDING"
  );

  return {
    model: vars["OPENAI_MODEL"] || "gpt-3.5-turbo",
    model_embedding: vars["OPENAI_MODEL_EMBEDDING"] || "text-embedding-ada-002",
    key: vars["OPENAI_KEY"],
    host: vars["OPENAI_PROXY"]
      ? vars["OPENAI_PROXY"]
      : "https://api.openai.com",
  };
}
