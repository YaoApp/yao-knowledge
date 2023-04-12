/**
 * OPENAI SDK
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

/**
 * Given a chat conversation, the model will return a chat completion response.
 * https://platform.openai.com/docs/api-reference/chat
 *
 * yao run scripts.openai.chat.CompletionsStream '::[{"role": "user", "content": "帮我写一个关于心血管健康的论文。"}]' max-1024
 *
 * @param {Array} messages
 * @param {String} user - optional
 * @param {Map} options - optional
 */
function CompletionsStream(messages, user, options) {
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

  let times = 0;
  return stream(url, paylad, cfg.key, (data) => {
    console.log(data);
    times++;
    if (times > 10) {
      return 0; // break
    }
    return 1;
  });
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
    let data = response.data || {};
    let err = data.error || {};
    let message = err.message || "unknown error";
    log.Error(`OpenAI API error ${message}`);
    throw new Exception(`OpenAI API error ${message}`, response.code || 500);
  }

  return response.data;
}

/**
 * Post data stream
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
