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
 * Given a chat conversation, the model will return a chat completion response.
 * https://platform.openai.com/docs/api-reference/chat
 *
 * yao run scripts.openai.chat.Completions '::[{"role": "user", "content": "Hello!"}]' max-1024
 *
 * @param {Array} messages
 * @param {String} user - optional
 * @param {Map} options - optional
 */
function Completions(messages, user, options) {
  let cfg = setting();
  let url = `${cfg.host}/v1/chat/completions`;

  messages = messages || [];
  options = options || {};
  if (user != "") {
    options["user"] = user;
  }

  let paylad = {
    model: cfg.model,
    messages: messages,
    ...options,
  };

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
