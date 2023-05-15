/**
 * vector database (on Weaviate)
 * Will be replaced by the new vector process
 */

const distance = 0.2;
const distancePrompts = 2;
const pageSize = 9;

/**
 * Query content from the vector database
 * @param {*} context
 * @param {*} messages
 * @returns
 */
function Match(context, messages) {
  console.log(context, messages);
  return [
    {
      role: "system",
      content: `{"name":"test.pdf", "url":"https://www.google.com"}`,
    },
    {
      role: "system",
      content: `
      - The above content is my knowledge base.
      - Please prioritize answering user questions based on my knowledge base provided to you.
     `,
    },
  ];
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
  return { code: 200, message: "ok" };
}

/**
 * PDF File
 * @param {*} file
 */
function Pdf(file) {
  const fs = new FS("system");
  const path = fs.Abs("111648967bdcb7c68e0a9197346b8cdf.pdf");
  console.log(path);

  const content = Process("plugins.pdf.Contenx", path);

  console.log(content);
}

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
            distance: ${distancePrompts}
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
            distance
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
    item.distance = item._additional.distance;
    delete item._additional;
  }
  return items;
}

/**
 *
 * Search Data
 * yao run scripts.vector.Search 帮我写一份心血管健康研究的报告 1 张三
 * yao run scripts.vector.Search 帮我写一份心血管健康研究的报告
 * @param {*} input
 * @param {*} page
 * @param {*} user
 * @returns
 */
function Search(input, page, user) {
  page = page ? parseInt(page) : 1;
  let offset = page ? (page - 1) * pageSize : 0;
  let vector = getVector(input);
  let cfg = setting();
  let url = `${cfg.host}/v1/graphql`;
  if (!user) {
    let info = Process("session.Get", "user") || {};
    user = info.id;
  }

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
      Aggregate {
        Document (
          nearVector: {
            vector: ${vector}
            distance: ${distance}
          }
          where: ${where}
        )
        {
          meta {
            count
          }
        }
      }
      Get {
        Document(
          limit: ${pageSize}
          offset: ${offset}
          nearVector: {
            vector: ${vector}
            distance: ${distance}
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
            lastUpdateTimeUnix,
            distance
          }
        }
      }
    }`,
  };

  response = post(url, payload, cfg.key);
  data = response.data || {
    Get: { Document: [] },
    Aggregate: { Document: [{ meta: { count: 0 } }] },
  };

  let total = data.Aggregate.Document[0].meta.count;
  let pages = Math.ceil(total / pageSize);
  let prev = page > 1 ? page - 1 : 1;
  let next = page < pages ? page + 1 : pages;
  let items = data.Get.Document || [];
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    item.id = item._additional.id;
    item.lastUpdateTimeUnix = item._additional.lastUpdateTimeUnix;
    item.distance = item._additional.distance;
    delete item._additional;
  }

  return {
    items: items,
    total: total,
    prev: prev,
    next: next,
    curr: page,
    pages: pages,
  };
}

function Find(id) {
  let cfg = setting();
  let url = `${cfg.host}/v1/objects/Document/${id}`;
  let response = get(url, { consistency_level: "ONE" }, cfg.key);
  response = response || {};
  response.properties = response.properties || {};
  for (let key in response.properties) {
    response[key] = response.properties[key];
  }
  delete response.properties;
  return response;
}

// === utils =================================

function getVector(input, user) {
  let response = Process(
    "openai.Embeddings",
    "openai.text-embedding-ada-002",
    input,
    user
  );

  let data = response.data || [];
  let embedding = data.length > 0 ? data[0].embedding : [];
  return JSON.stringify(embedding);
}

function getSummary(content) {
  let response = Process("openai.chat.Completions", "openai.gpt-3_5-turbo", [
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
 * Generate test data
 * yao run scripts.vector.testContent
 */
function testContent() {
  let response = Process("openai.chat.Completions", "openai.gpt-3_5-turbo", [
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
      content: `Generate 5 items, You must only respond JSON Object.`,
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

  if (response.code == 404) {
    throw new Exception(`not found`, 404);
  }

  if (response.code != 200) {
    if (response.data && response.data.message && response.data.code) {
      throw new Exception(
        response.data.message.split(":")[0],
        response.data.code
      );
    }

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
