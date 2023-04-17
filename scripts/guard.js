function Chat(path, params, query, payload, headers) {
  query = query || {};
  token = query.token || "";
  if (token == "" || token.length == 0) {
    throw new Exception("No token provided", 403);
  }

  let data = Process("utils.jwt.Verify", token[0]);
  return { __sid: data.sid, __global: data.data };
}
