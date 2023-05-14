/**
 * Neo API Guard
 * @param {*} path
 * @param {*} params
 * @param {*} query
 * @param {*} payload
 * @param {*} headers
 * @returns
 */
function Chat(path, params, query, payload, headers) {
  query = query || {};
  token = query.token || "";
  if (token == "" || token.length == 0) {
    throw new Exception("No token provided", 403);
  }

  jwt = token[0] || "";
  jwt = jwt.replace("Bearer ", "");
  console.log(jwt);

  let data = Process("utils.jwt.Verify", jwt);
  return { __sid: data.sid, __global: data.data };
}

/**
 * User Login
 * yao run scripts.user.Login '::{"email":"user1@example.com","password":"J8p#S$4@"}'
 * @param {*} payload
 */
function Login(payload) {
  // Check if user exists
  let users = Process("models.user.Get", {
    select: ["id", "email", "password", "name", "status", "title"],
    wheres: [
      { column: "email", value: payload.email },
      { column: "status", value: "enabled" },
    ],
  });
  if (users.length == 0) {
    throw new Exception("用户不存在", 404);
  }

  // check password
  let user = users[0] || {};
  Process("utils.pwd.Verify", payload.password, user.password);

  // make jwt token
  // args[0]*: id
  // args[1]*: user data
  // args[2] : option: {"subject":"<主题>", "audience": "<接收人>", "issuer":"<签发人>", "timeout": "<有效期,单位秒>", "sid":"<会话ID>"}
  let sid = Process("utils.str.UUID");
  let timeout = 60 * 60;
  let data = { sid: sid, name: user.name, title: user.title };
  let token = Process("utils.jwt.Make", user.id, data, {
    subject: "Web Client Login",
    timeout: timeout,
    issuer: "user.Login",
    audience: "Web Client",
    sid: sid,
  });

  // save to session
  delete user.password;
  Process("session.Set", "user", user, timeout, sid);
  return { ...data, ...token };
}
