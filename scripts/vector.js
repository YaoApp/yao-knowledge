/**
 * vector database (on Weaviate)
 * Will be replaced by the new vector process
 */

/**
 * the schema of the vector database
 */
const DocumentSchema = {
  class: "Document",
  description: "Used to store documents",
  vectorizer: "text2vec-openai",
  moduleConfig: {
    "text2vec-openai": { model: "ada", modelVersion: "002", type: "text" },
  },
  properties: [
    {
      name: "type",
      dataType: ["string"],
      description:
        "The type of the document (e.g. note, ppt, doc, xls, pdf, url, etc.)",
      moduleConfig: {
        "text2vec-openai": { skip: false, vectorizePropertyName: false },
      },
    },
    {
      name: "path",
      dataType: ["string"],
      description: "the file path of the document",
      moduleConfig: {
        "text2vec-openai": { skip: true, vectorizePropertyName: false },
      },
    },
    {
      name: "user",
      dataType: ["string"],
      description: "the user of the document",
      moduleConfig: {
        "text2vec-openai": { skip: true, vectorizePropertyName: false },
      },
    },
    {
      name: "url",
      dataType: ["string"],
      description: "the url of the document",
      moduleConfig: {
        "text2vec-openai": { skip: true, vectorizePropertyName: false },
      },
    },
    {
      name: "summary",
      dataType: ["string"],
      description: "The summary of the document",
      moduleConfig: {
        "text2vec-openai": { skip: false, vectorizePropertyName: false },
      },
    },
    {
      name: "content",
      dataType: ["text"],
      description: "The content of the document",
      moduleConfig: {
        "text2vec-openai": { skip: false, vectorizePropertyName: false },
      },
    },
  ],
};

/**
 * Create a schema (run when the application setup)
 * yao run scripts.vector.SchemaCreate
 */
function SchemaCreate() {
  let cfg = setting();
  let url = `${cfg.host}/v1/schema`;
  return post(url, DocumentSchema, cfg.key);
}

/**
 * SchemaGet
 * @returns
 */
function SchemaGet() {
  let cfg = setting();
  let url = `${cfg.host}/v1/schema`;
  let data = get(url, {}, cfg.key);
  if (data.classes.length < 1) {
    throw new Exception("Document not found", 404);
  }
  return data.classes[0];
}

/**
 * Make a test
 * yao run scripts.vector.Test
 */
function Test() {
  console.log("请稍等,这将花费一些时间...");
  let content = testContent();
  let id = Insert({ content: content });
  return id;
}

/**
 * Insert Data
 *
 * yao run scripts.vector.Insert '::{"content": "这是一直测试文档，你需要从这里开始。"}'
 *
 * @param {*} data
 */
function Insert(data) {
  data = data || {};
  if (!data.content) {
    throw new Exception("content is required", 400);
  }

  let cfg = setting();
  let url = `${cfg.host}/v1/objects?consistency_level=ALL`;

  let properties = {};
  properties.type = data.type || "note";
  properties.path = data.path || "";
  properties.user = data.user || "__public";
  properties.url = data.url || "";
  properties.content = data.content; // required
  properties.summary = data.summary || getSummary(data.content);
  let res = post(url, { class: "Document", properties: properties }, cfg.key);
  return res.id;
}

/**
 * Get Objects
 * yao run scripts.vector.Objects
 */
function Objects() {
  let cfg = setting();
  let url = `${cfg.host}/v1/objects`;
  return get(url, {}, cfg.key);
}

// === utils =================================

function getSummary(content) {
  let response = Process("scripts.openai.chat.Completions", [
    {
      role: "system",
      content: `
      你只能回复200字的内容摘要。
      不要解释你的答案，也不要使用标点符号。
    `,
    },
    { role: "user", content: content },
  ]);

  let choices = response.choices || [];
  if (choices.length < 1) {
    throw new Exception("answer error", 400);
  }

  let message = choices[0].message || {};
  return message.content;
}

function testContent() {
  let response = Process("scripts.openai.chat.Completions", [
    {
      role: "system",
      content: `
      你只能回复200字的内容摘要。
      不要解释你的答案，也不要使用标点符号。
      `,
    },
    { role: "user", content: "生成一篇唯美的文章" },
  ]);

  let choices = response.choices || [];
  if (choices.length < 1) {
    throw new Exception("answer error", 400);
  }

  let message = choices[0].message || {};
  return message.content;
}

/**
 * Post data
 * @param {*} url
 * @param {*} payload
 * @param {*} key
 * @returns
 */
function get(url, query, key) {
  let response = http.Get(url, query, null, null, {
    "X-OpenAI-Api-Key": key,
  });

  if (response.code != 200) {
    let errors = response.data.error || response.data;
    let message = errors.length > 0 ? errors[0].message : "unknown";
    throw new Exception(message, response.code || 500);
  }

  return response.data;
}

/**
 * Post data
 * @param {*} url
 * @param {*} payload
 * @param {*} key
 * @returns
 */
function post(url, payload, key) {
  let response = http.Post(url, payload, null, null, {
    "X-OpenAI-Api-Key": key,
  });

  if (response.code != 200) {
    let errors = response.data.error || response.data;
    let message = errors.length > 0 ? errors[0].message : "unknown";
    throw new Exception(message, response.code || 500);
  }

  return response.data;
}

/**
 * Get Weaviate setting
 * @returns {Map}
 */
function setting() {
  let vars = Process("utils.env.GetMany", "WEAVIATE_HOST", "OPENAI_KEY");
  return {
    key: vars["OPENAI_KEY"],
    host: vars["WEAVIATE_HOST"]
      ? vars["WEAVIATE_HOST"]
      : "http://127.0.0.1:5080",
  };
}
