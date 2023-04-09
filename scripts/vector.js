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
  post(url, DocumentSchema, cfg.key);
  return "Document";
}

/**
 * Create a schema (run when the application setup)
 * yao run scripts.vector.SchemaDelete
 */
function SchemaDelete() {
  let cfg = setting();
  let url = `${cfg.host}/v1/schema/Document`;
  let response = http.Delete(url);
  if (response.code != 200) {
    let errors = response.data.error || response.data;
    let message = errors.length > 0 ? errors[0].message : "unknown";
    throw new Exception(message, response.code || 500);
  }

  return true;
}

/**
 * Create a schema (run when the application setup)
 * yao run scripts.vector.SchemaReset
 */
function SchemaReset() {
  SchemaDelete();
  return SchemaCreate();
}

/**
 * SchemaGet
 * yao run scripts.vector.SchemaGet
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
  let text = testContent();
  let contents = [];

  try {
    contents = JSON.parse(text);
  } catch (err) {
    console.log(err, text);
  }

  let ids = [];
  contents.forEach((object) => {
    let id = Insert(object);
    ids.push(id);
  });
  return ids;
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

/**
 * Query Data
 * yao run scripts.vector.Query 帮我写一份心血管健康研究的报告 张三
 * yao run scripts.vector.Query 帮我写一份心血管健康研究的报告
 * @param {*} input
 * @param {*} user
 */
function Query(input, user) {
  let vector = getVector(input);
  let cfg = setting();
  let url = `${cfg.host}/v1/graphql`;

  let where = `{ 
    operator: Or,
    operands: {
      path: ["user"],
      operator: Equal,
      valueString: "__public"
    }
  }`;

  if (user) {
    where = `{ 
      operator: Or,
      operands: [
        {
          path: ["user"],
          operator: Equal,
          valueString: "${user}"
        },{
          path: ["user"],
          operator: Equal,
          valueString: "__public"
        }
      ]
    }`;
  }

  let payload = {
    query: `{
      Get {
        Document(
          limit: 10
          nearVector: {
            vector: ${vector}
          }
          where: ${where}
        ) 
        {
          user
          path
          type
          url
          summary
          content
          _additional{
            id
            lastUpdateTimeUnix
          }
        }
      }
    }`,
  };
  let response = post(url, payload, cfg.key);
  let data = response.data || { Get: { Document: [] } };
  let items = data.Get.Document || [];
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    item.id = item._additional.id;
    item.lastUpdateTimeUnix = item._additional.lastUpdateTimeUnix;
    delete item._additional;
  }
  return items;
}

// === utils =================================

function getVector(input, user) {
  let response = Process("scripts.openai.Embeddings", input, user);
  let data = response.data || [];
  let embedding = data.length > 0 ? data[0].embedding : [];
  return JSON.stringify(embedding);
}

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

/**
 * Generate test data
 * yao run scripts.vector.testContent
 */
function testContent() {
  let response = Process("scripts.openai.chat.Completions", [
    { role: "system", content: JSON.stringify(DocumentSchema.properties) },
    {
      role: "system",
      content: `
      - Generate a set of data according to the data type given to your data structure.
      - You can only respond with: [{"<properties.name>":"<your generated data>", ...}...]"
      - The type property is required, and the value can only be: "note", "ppt", "doc", "xls", "pdf", "url"
      - If the type is url, the url property is required, otherwise, the path property is required.
      - The property value should be Chinese generated according to the data type.
      - The content property is required.
      - The summary property value should be the summary of content property.
      - all properties are required, but some properties can be empty.
      - Do not explain your answer, and do not use punctuation.
      `,
    },
    {
      role: "user",
      content: `Generate 10 items, You must only respond JSON Object.`,
    },
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
