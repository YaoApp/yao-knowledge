/**
 * Document schema structure
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
      name: "day",
      dataType: ["date"],
      description: "the date of the document",
      moduleConfig: {
        "text2vec-openai": { skip: true, vectorizePropertyName: false },
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
      name: "name",
      dataType: ["string"],
      description: "The name of the document",
      moduleConfig: {
        "text2vec-openai": { skip: false, vectorizePropertyName: false },
      },
    },
    {
      name: "fingerprint",
      dataType: ["string"],
      description: "The fingerprint of the document",
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
    {
      name: "part",
      dataType: ["int"],
      description: "The part id of the file document",
      moduleConfig: {
        "text2vec-openai": { skip: true, vectorizePropertyName: false },
      },
    },
  ],
};

const required = ["content", "fingerprint", "type", "part"];

/**
 * Insert document
 * yao run scripts.doc.Insert '::{"content":"这是一只懒狗", "fingerprint":"819281", "type":"pdf", "part":0}'
 * @param {*} data
 */
function Insert(data) {
  data = data || {};

  // validate Required fields
  required.forEach((field) => {
    if (data[field] == undefined) {
      throw new Exception(`${field} is required`, 400);
    }
  });

  // Set default values
  data.user = data.user || "__public";
  data.path = data.path || "";
  data.url = data.url || "";
  data.name = data.name || Process("aigcs.title", data.content);
  data.summary = data.summary || Process("aigcs.summary", data.content);
  data.day = data.day || new Date().toISOString().split("T")[0] + "T00:00:00Z";

  // Insert document
  let cfg = setting();
  let url = `${cfg.host}/v1/objects?consistency_level=ALL`;
  let res = post(url, { class: "Document", properties: data }, cfg.key);
  return res.id;
}

/**
 * Get Objects
 * yao run scripts.doc.Get
 * @param {*} id
 * @returns
 */
function Get() {
  let cfg = setting();
  let url = `${cfg.host}/v1/objects`;
  return get(url, null, cfg.key);
}

/**
 * Get GetFiles
 * yao run scripts.doc.GetDocs
 * @returns
 */
function GetFiles(query) {
  let type = "pdf";
  if (
    query &&
    query.wheres &&
    query.wheres[0] &&
    query.wheres[0].column == "type"
  ) {
    type = query.wheres[0].value;
  }

  let payload = `{
    Aggregate {
        Document(
          groupBy: ["fingerprint"]
          where: {
            path: ["type"],
            operator: Equal,
            valueString:"${type}"
          }
        ){
          groupedBy {
            value
            path
          }
          meta {  count }
        }
    }
}`;

  let cfg = setting();
  let url = `${cfg.host}/v1/graphql`;
  let objects = post(url, { query: payload }, cfg.key);
  let data = objects.data || {};
  let ids = [];

  if (
    data &&
    data.Aggregate &&
    data.Aggregate.Document &&
    data.Aggregate.Document.length > 0
  ) {
    data.Aggregate.Document.forEach((doc) => {
      if (doc.groupedBy && doc.groupedBy.value) {
        ids.push(`${doc.groupedBy.value}.pdf`);
      }
    });
  }

  return ids;
}

/**
 * Admin Setting Process: Reset document
 * @param {*} id
 */
function AdminSettingReset(id) {
  try {
    const fs = new FS("system");
    let files = GetFiles();
    files.forEach((file) => {
      fs.Remove(file);
    });
  } catch (e) {}

  SchemaReset();
  return id;
}

/**
 * Admin Setting  Process:  document Setting
 * @param {*} id
 * @returns
 */
function AdminSettingFind(id) {
  let cfg = setting();
  let url = `${cfg.host}/v1/objects/${id}`;
  return {
    id: id,
    schema: "Document",
    documents: adminDocsCount({}),
    parts: adminCount({}),
  };
}

/**
 * Admin Process: Remove document
 * @param {*} id
 * @returns
 */
function AdminDelete(id) {
  return DeletePart(id);
}

/**
 * Admin Process: Find document
 * @param {*} id
 * @returns
 */
function AdminFind(id) {
  let cfg = setting();
  let url = `${cfg.host}/v1/objects/${id}`;
  return get(url, null, cfg.key);
}

/**
 * Admin Process: Search documents
 * @param {*} query
 * @param {*} page
 * @param {*} pageSize
 */
function AdminSearch(query, page, pageSize) {
  let type = "pdf";
  if (
    query &&
    query.wheres &&
    query.wheres[0] &&
    query.wheres[0].column == "type"
  ) {
    type = query.wheres[0].value;
  }

  let total = adminCount(query);
  let pagecnt = Math.ceil(total / pageSize);

  const offset = (page - 1) * pageSize;
  let payload = `{
    Get {
      Document(
        offset: ${offset}
        limit: ${pageSize}
        where: {
            path: ["type"],
            operator: Equal,
            valueString:"${type}"
        }
        sort: [
            {path: ["_lastUpdateTimeUnix"], order: desc}
        ]
      ) 
      { 
        name
        path
        summary
        fingerprint
        part
        _additional{
            id
            creationTimeUnix
            lastUpdateTimeUnix
        }
      }
    }
  }`;

  let cfg = setting();
  let url = `${cfg.host}/v1/graphql`;
  let objects = post(url, { query: payload }, cfg.key);
  let items = objects.data || {};
  let data = [];
  if (
    items &&
    items.Get &&
    items.Get.Document &&
    items.Get.Document.length > 0
  ) {
    items.Get.Document.forEach((item) => {
      data.push({
        id: item._additional.id,
        name: item.name,
        path: item.path,
        summary:
          item.summary.length > 50
            ? item.summary.substring(0, 50) + "..."
            : item.summary,
        fingerprint: item.fingerprint,
        part: `片段: ${item.part + 1}`,

        created_at: new Date(
          parseInt(item._additional.creationTimeUnix)
        ).toLocaleString(),

        updated_at: new Date(
          parseInt(item._additional.lastUpdateTimeUnix)
        ).toLocaleString(),
      });
    });
  }

  return {
    data: data,
    next: -1,
    page: parseInt(page),
    pagecnt: pagecnt,
    prev: -1,
    total: total,
  };
}

/**
 * Get Stat
 * yao run scripts.doc.AdminStat
 */
function AdminStat() {
  return {
    latest: adminLatestDocs({}),
    documents: adminDocsCount({}),
    parts: adminCount({}),
  };
}

function adminLatestDocs(query) {
  let type = "pdf";
  if (
    query &&
    query.wheres &&
    query.wheres[0] &&
    query.wheres[0].column == "type"
  ) {
    type = query.wheres[0].value;
  }

  let today = new Date();
  let sevenDaysAgo =
    new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0] + "T00:00:00Z";

  let payload = `{
    Aggregate {
        Document(
          groupBy: ["day"]
          where: {
            path: ["day"],
            operator: GreaterThanEqual,
            valueDate:"${sevenDaysAgo}"
          }
        ){
          groupedBy {
            value
            path
          }
          meta {  count }
        }
        }
    }`;

  let cfg = setting();
  let url = `${cfg.host}/v1/graphql`;
  let objects = post(url, { query: payload }, cfg.key);
  let data = objects.data || {};
  let items = [];
  let days = {};

  if (
    data.Aggregate &&
    data.Aggregate.Document &&
    data.Aggregate.Document.length > 0
  ) {
    data.Aggregate.Document.forEach((item) => {
      days[item.groupedBy.value.split("T")[0]] = item.meta.count;
    });
  }

  for (let i = 0; i < 7; i++) {
    let day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    if (!days[day]) {
      days[day] = 0;
    }

    items.unshift({ day: day, count: days[day] });
  }
  return items;
}

/**
 * count documents
 * @param {*} query
 * @param {*} page
 * @param {*} pageSize
 */
function adminCount(query) {
  let type = "pdf";
  if (
    query &&
    query.wheres &&
    query.wheres[0] &&
    query.wheres[0].column == "type"
  ) {
    type = query.wheres[0].value;
  }

  let payload = `{
    Aggregate {
        Document(
            where: {
                path: ["type"],
                operator: Equal,
                valueString:"${type}"
            }
        ){
            meta {  count }
        }
    }
}`;

  let cfg = setting();
  let url = `${cfg.host}/v1/graphql`;
  let objects = post(url, { query: payload }, cfg.key);
  let data = objects.data || {};

  if (
    data &&
    data.Aggregate &&
    data.Aggregate.Document &&
    data.Aggregate.Document.length > 0
  ) {
    return data.Aggregate.Document[0].meta.count;
  }

  return 0;
}

/**
 * count documents
 * @param {*} query
 * @param {*} page
 * @param {*} pageSize
 * yao run scripts.doc.adminDocsCount
 */
function adminDocsCount(query) {
  let type = "pdf";
  if (
    query &&
    query.wheres &&
    query.wheres[0] &&
    query.wheres[0].column == "type"
  ) {
    type = query.wheres[0].value;
  }

  let payload = `{
    Aggregate {
        Document(
          groupBy: ["fingerprint"]
          where: {
            path: ["type"],
            operator: Equal,
            valueString:"${type}"
          }
        ){
          groupedBy {
            value
            path
          }
          meta {  count }
        }
    }
}`;

  let cfg = setting();
  let url = `${cfg.host}/v1/graphql`;
  let objects = post(url, { query: payload }, cfg.key);
  let data = objects.data || {};

  if (
    data &&
    data.Aggregate &&
    data.Aggregate.Document &&
    data.Aggregate.Document.length > 0
  ) {
    return data.Aggregate.Document.length;
  }

  return 0;
}

/**
 * Delete document
 * yao run scripts.doc.Delete 819281
 * @param {*} fingerprint
 */
function DeletePart(id) {
  if (!id) {
    throw new Exception("id is required", 400);
  }

  let cfg = setting();
  let url = `${cfg.host}/v1/objects/${id}?consistency_level=ALL`;
  remove(url, {}, cfg.key);
  return id;
}

/**
 * Delete document
 * yao run scripts.doc.Delete 819281
 * @param {*} fingerprint
 */
function Delete(fingerprint) {
  if (!fingerprint) {
    throw new Exception("fingerprint is required", 400);
  }

  let query = `{
    Get {
      Document(where: {
        path: ["fingerprint"],
        operator: Equal,
        valueString:"${fingerprint}"
      }) 
      { 
        fingerprint
        _additional{id}
      }
    }
  }`;

  let cfg = setting();
  let url = `${cfg.host}/v1/graphql`;
  let objects = post(url, { query: query }, cfg.key);
  let data = objects.data || {};
  let ids = [];
  if (data && data.Get && data.Get.Document && data.Get.Document.length > 0) {
    data.Get.Document.forEach((item) => {
      ids.push(item._additional.id);
    });
  }

  // Delete documents
  ids.forEach((id) => {
    let url = `${cfg.host}/v1/objects/${id}?consistency_level=ALL`;
    remove(url, {}, cfg.key);
  });

  return ids;
}

/**
 * Check if schema exists
 * yao run scripts.doc.SchemaExists
 * @returns bool
 */
function SchemaExists() {
  let cfg = setting();
  let url = `${cfg.host}/v1/schema/Document`;
  let response = {};
  try {
    response = get(url, null, cfg.key);
  } catch (e) {
    console.log(e);
    return false;
  }
  return true;
}

/**
 * Create schema
 * yao run scripts.doc.SchemaCreate
 * @returns
 */
function SchemaCreate() {
  let cfg = setting();
  let url = `${cfg.host}/v1/schema`;
  post(url, DocumentSchema, cfg.key);
  return true;
}

/**
 * Remove schema
 * yao run scripts.doc.SchemaDelete
 * @returns
 */
function SchemaDelete() {
  let cfg = setting();
  let url = `${cfg.host}/v1/schema/Document`;
  return remove(url);
}

/**
 * Reset schema
 * yao run scripts.doc.SchemaReset
 */
function SchemaReset() {
  if (SchemaExists()) {
    SchemaDelete();
  }
  return SchemaCreate();
}

/**
 * Validate schema
 */
function SchemaValidate() {
  // Replace with your code here
  return true;
}

/**
 * Post reqeust
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
 * Delete reqeust
 * @param {*} url
 * @param {*} payload
 * @param {*} key
 * @returns
 */
function remove(url, payload, key) {
  let response = http.Delete(url, payload, null, { "X-OpenAI-Api-Key": key });
  if (response.code != 200 && response.code != 204) {
    let errors = response.data ? response.data.error : [];
    let message = errors.length > 0 ? errors[0].message : "unknown";
    throw new Exception(message, response.code || 500);
  }

  return true;
}

/**
 * Get reqeust
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
