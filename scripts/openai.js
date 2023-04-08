/**
 * ChatGPT API
 * Will be replaced by the new openai process
 */

//
// Environment variables:
//
//  - OPENAI_MODEL: gpt-3.5-turbo-0301
//  - OPENAI_MODEL_EMBEDDING: text-embedding-ada-002
//  - OPENAI_KEY: xxxx
//  - OPENAI_PROXY: https://proxy.xxx.com
//

/**
 * Get a vector representation of a given input that can be easily consumed by machine learning models and algorithms.
 * https://platform.openai.com/docs/api-reference/embeddings
 *
 * yao run scripts.openai.Embeddings hello max-1024
 *
 * @param {String} input
 * @param {String} user - optional
 */
function Embeddings(input, user) {
  let cfg = setting();
  let url = `${cfg.host}/v1/embeddings`;
  let paylad = { model: cfg.model_embedding, input: input };
  if (user != "") {
    paylad["user"] = user;
  }
  return post(url, paylad, cfg.key);
}

// === utils =================================

/**
 * Post data
 * @param {*} url
 * @param {*} payload
 * @param {*} key
 * @returns
 */
function post(url, payload, key) {
  let response = http.Post(url, payload, null, null, {
    Authorization: `Bearer ${key}`,
  });

  console.log(response);

  if (response.code != 200) {
    throw new Exception(
      "OpenAI API error: " + response.body,
      response.code || 500
    );
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
    model: vars["OPENAI_MODEL"] || "gpt-3.5-turbo-0301",
    model_embedding: vars["OPENAI_MODEL_EMBEDDING"] || "text-embedding-ada-002",
    key: vars["OPENAI_KEY"],
    host: vars["OPENAI_PROXY"]
      ? vars["OPENAI_PROXY"]
      : "https://api.openai.com",
  };
}
