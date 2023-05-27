/**
 * vector database (on Weaviate)
 * Will be replaced by the new vector process
 */

const MaxTokens = 1536;

/**
 * Match content from the vector database
 * yao run scripts.vector.Match '::{"pathname":"/x/Table"}' '::[{"role":"user", "content":"Yao 是什么"}]'
 *
 * @param {*} context
 * @param {*} messages
 * @returns
 */
function Match(context, messages) {
  return match(context, messages, 2048);
}

/**
 * Search content from the vector database
 * @param {*} input
 * @param {*} page
 * @returns
 */
function Search(input, page) {
  const params = { input: input, distance: 0.25 };
  return Process("scripts.doc.Search", params, page, 9);
}

/**
 * Save the content to the vector database
 * @param {*} payload
 * @returns
 */
function Save(payload) {
  const fs = new FS("system");
  const id =
    payload.fingerprint || Process("utils.str.UUID").replaceAll("-", "");

  const file = `${id}.pdf`;
  if (fs.Exists(file)) {
    throw new Exception(`${id} content exits`, 409);
  }

  fs.WriteFileBase64(file, payload.content, 0644);

  // =============================================================================
  // Read the PDF content
  // @todo You can add your own code here
  // @see https://github.com/YaoApp/yao-knowledge-pdf
  // ==============================================================================
  const pages = Process("plugins.pdf.Content", fs.Abs(file));
  if (pages && pages.code && pages.message) {
    console.log(
      "",
      `pdf.so plugin error: ${pages.code} ${pages.message}`,
      "maybe you need install pdf plugin see here: https://github.com/YaoApp/yao-knowledge-pdf"
    );

    fs.Remove(file);
    throw new Exception(pages.message, pages.code);
  }

  // fs.Remove(file); // debug

  console.log("Parse the PDF title and summary...");
  const article = Reduce(pages.join("\n\n"));
  let title = "";
  let summary = "";
  try {
    title = Process("aigcs.title", article);
    summary = Process("aigcs.summary", article);
  } catch (e) {
    fs.Remove(file);
    throw e;
  }

  // Save the document to the vector database
  let part = 0;
  pages.forEach((content, index) => {
    content = content.replaceAll(" ", "");
    content = content.replaceAll("\n", "");
    content = content.replaceAll("\r", "");

    // Ignore the short content
    if (content == "" || content.length < 20) {
      return;
    }

    // =============================================================================
    // Save the document to the vector database
    // @todo You can add your own code here
    // ==============================================================================
    const doc = {
      type: "pdf",
      path: file,
      fingerprint: id,
      user: "__public",
      name: title,
      summary: summary,
      content: content,
      part: part,
    };

    const result = Process("scripts.doc.Insert", doc);
    if (result && result.code && result.message) {
      fs.Remove(file);
      throw new Exception(result.message, result.code);
    }

    part = part + 1;

    // Debug
    console.log(doc);

    // openai api limit
    time.Sleep(200);
  });

  // debug
  // console.log(pages);
  return { code: 200, message: "ok" };
}

/**
 * Reduce the content size
 * @param {*} content
 */
function Reduce(content) {
  var tokenSize = MaxTokens;
  if (content.length > 5000) {
    content = content.substring(0, 5000);
  }

  while (tokenSize >= MaxTokens) {
    // process: openai.Tiktoken
    // args[0]: is the model name
    // args[1]: is the content
    tokenSize = Process("openai.Tiktoken", "gpt-3.5-turbo", content);
    content = content.substring(0, content.length - 128);
    console.log(`Reduce the content size to ${tokenSize}`);
  }
  return content;
}

/**
 * ReadFile the doc file
 * @param {*} file
 */
function ReadFile(file) {
  const fs = new FS("system");
  const path = fs.Abs(file);

  // you can add your own code here
  const content = Process("plugins.pdf.Content", path);
  if (content && content.code && content.message) {
    throw new Exception(content.message, content.code);
  }

  return content;
}

/**
 * match the content
 * @param {*} context
 * @param {*} messages
 */
function match(context, messages, maxTokenSize) {
  // =============================================================================
  // You can add your own code here
  // Change the code to match your own knowledge base
  // ==============================================================================

  messages = messages || [];
  if (messages.length == 0) {
    throw new Exception("messages is empty", 400);
  }

  const input = messages[messages.length - 1].content || "";
  if (input == "") {
    throw new Exception("input is empty", 400);
  }

  const payload = { input: input, distance: 1.9 };
  const resp = Process("scripts.doc.Query", payload, 1, 20);
  if (resp && resp.code && resp.message) {
    throw new Exception(resp.message, resp.code);
  }

  const docs = resp.data || [];
  return ReduceMessage(messages, docs, maxTokenSize);
}

function ReduceMessage(messages, docs, maxTokenSize) {
  // =============================================================================
  // You can add your own code here
  // Change the code to match your own knowledge base
  // ==============================================================================

  maxTokenSize = maxTokenSize == undefined ? MaxTokens : maxTokenSize;
  newMessages = [
    {
      role: "system",
      content: `
      - The above content is my knowledge base.
      - The field "content" is the content of the document.
      - The field "summary" is the summary of the document.
      - The field "name" is the title of the document.
      - The field "path" is the file path of the document.
      - The field "type" is the type of the document.
      - Please prioritize answering user questions based on my knowledge base provided to you.
     `,
    },
  ];

  messageText = JSON.stringify(messages);
  let tokenSize = 0;
  while (tokenSize < maxTokenSize) {
    const doc = docs.shift();
    if (!doc) {
      break;
    }
    newMessages.unshift({ role: "system", content: JSON.stringify(doc) });
    const text = JSON.stringify(newMessages) + messageText;
    tokenSize = Process("openai.Tiktoken", "gpt-3.5-turbo", text);
  }

  console.log("--- Vector Query------", messages);

  if (newMessages.length > 1) {
    console.log("--- Vector Match ---", newMessages);
  }

  return newMessages.length > 1 ? newMessages : [];
}
