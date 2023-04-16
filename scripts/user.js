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
  delete user.password;

  // make jwt token
  // args[0]*: id
  // args[1]*: user data
  // args[2] : option: {"subject":"<主题>", "audience": "<接收人>", "issuer":"<签发人>", "timeout": "<有效期,单位秒>", "sid":"<会话ID>"}
  let sid = Process("utils.str.UUID");
  let timeout = 60 * 60;
  let token = Process("utils.jwt.Make", user.id, user, {
    subject: "Web Client Login",
    timeout: timeout,
    issuer: "user.Login",
    audience: "Web Client",
    sid: sid,
  });

  // save to session
  Process("session.Set", "user", user, timeout, sid);
  return token;
}
