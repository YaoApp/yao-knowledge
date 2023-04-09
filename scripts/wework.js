/**
 * Get message from Proxy
 * @param {*} data
 * @param {*} query
 */
function EventProxy(data, query) {
  console.log(data);
}

function EventAssistant(body) {
  let cfg = setting();
  let msg = message(body);
  var response = Process("yao.wework.Decrypt", cfg.aeskey, msg, true);
  let data = response.data || {};
  let event = data.xml || {};
  if (event.OpenKfId) {
    let data = synMsg(event, msgCursor());
    let groups = groupByUserID(data);
    for (var sid in groups) {
      // // serviceState(event.OpenKfId, sid, 1);
      // let state = getServiceState(event.OpenKfId, sid);
      // console.log(state);

      let messages = [];
      groups[sid].forEach((item) => {
        console.log(sid, item);
        if (item.event && item.event.event_type == "enter_session") {
          welcome(sid, item);
          return;
        } else if (item.msgtype == "text") {
          messages.push(item.text.content);
        }
      });

      if (messages.length > 0) {
        reply(sid, messages.join("\n"), groups[sid][0]);
      }
    }
  }

  return { code: 200, message: "success" };
}

function EventAssistantVerify(data, query) {
  let cfg = setting();
  if (data.echostr && data.echostr.length) {
    var echostr = data.echostr[0];
    var res = Process("yao.wework.Decrypt", cfg.aeskey, echostr);
    if (res.message) {
      return res.message;
    }
  }
  throw new Exception("Invalid request", 400);
}

/**
 * Get wework setting
 * @returns {Map}
 */
function setting() {
  let vars = Process(
    "utils.env.GetMany",
    "WEWORK_AESKEY",
    "WEWORK_TOKEN",
    "WEWORK_SECRET",
    "WEWORK_APPID",
    "WEWORK_CORPID"
  );
  return {
    aeskey: vars["WEWORK_AESKEY"],
    token: vars["WEWORK_TOKEN"],
    secret: vars["WEWORK_SECRET"],
    appid: vars["WEWORK_APPID"],
    corpid: vars["WEWORK_CORPID"],
  };
}

function welcome(sid, item) {
  sendMsg(
    item.event.external_userid,
    item.event.open_kfid,
    "欢迎使用开发者助手",
    `${new Date().getTime()}`
  );
}

function reply(sid, input, item) {
  // console.log(`reply to 开发者 ${sid}`, input);
  let res = {};

  sendMsg(
    item.external_userid,
    item.open_kfid,
    "正在查询，请稍后...",
    `${new Date().getTime()}`
  );

  try {
    res = Process("scripts.qna.Answer", input, sid, sid);
  } catch (err) {
    console.log(err);
    sendMsg(
      item.external_userid,
      item.open_kfid,
      "出错了，请稍后再试",
      `${new Date().getTime()}`
    );
    return;
  }

  sendMsg(
    item.external_userid,
    item.open_kfid,
    res.content,
    `${new Date().getTime()}`
  );
}

function getServiceState(open_kfid, external_userid) {
  let token = accessToken();
  let url = `https://qyapi.weixin.qq.com/cgi-bin/kf/service_state/get?access_token=${token}`;
  let payload = {
    open_kfid: open_kfid,
    external_userid: external_userid,
  };
  let res = http.Post(url, payload);

  if (res.code == 200 && res.data && res.data.errmsg == "ok") {
    return res.data.service_state;
  }

  if (res && res.data && res.data.errcode) {
    let message = res.data.errmsg.split(",")[0];
    throw new Exception(`${res.data.errcode} ${message}`, 400);
  }

  throw new Exception("Invalid request", 400);
}

function setServiceState(open_kfid, external_userid, service_state) {
  let token = accessToken();
  let url = `https://qyapi.weixin.qq.com/cgi-bin/kf/service_state/trans?access_token=${token}`;
  let payload = {
    open_kfid: open_kfid,
    external_userid: external_userid,
    service_state: service_state,
  };
  let res = http.Post(url, payload);

  if (res.code == 200 && res.data && res.data.errmsg == "ok") {
    return true;
  }

  if (res && res.data && res.data.errcode) {
    let message = res.data.errmsg.split(",")[0];
    throw new Exception(`${res.data.errcode} ${message}`, 400);
  }

  throw new Exception("Invalid request", 400);
}

function sendMsg(external_userid, open_kfid, content, msgid) {
  let payload = {
    touser: external_userid,
    open_kfid: open_kfid,
    msgtype: "text",
    text: { content: content },
  };

  if (msgid) {
    payload.msgid = msgid;
  }

  // console.log(payload);

  let token = accessToken();
  let url = `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${token}&debug=1`;
  let res = http.Post(url, payload);

  // console.log(res);

  if (res.code == 200 && res.data && res.data.errmsg == "ok") {
    return true;
  }

  if (res && res.data && res.data.errcode) {
    let message = res.data.errmsg.split(",")[0];
    throw new Exception(`${res.data.errcode} ${message}`, 400);
  }

  throw new Exception("Invalid request", 400);
}

/**
 * Sync message
 * @param {*} event
 * @param {*} cursor
 * @returns
 */
function synMsg(event, cursor) {
  event = event || {};
  let payload = {
    token: event.Token,
    open_kfid: event.OpenKfId,
    cursor: cursor,
  };
  let token = accessToken();
  let url = `https://qyapi.weixin.qq.com/cgi-bin/kf/sync_msg?access_token=${token}`;
  let res = http.Post(url, payload);
  let items = [];
  if (res.code == 200 && res.data && res.data.errmsg == "ok") {
    let next = res.data.next_cursor;
    let hasMore = res.data.has_more;

    let cfg = setting();
    let store = new Store("message");
    store.Set(`wework_${cfg.corpid}_cursor`, next);
    items = [...res.data.msg_list];
    if (hasMore == 1) {
      items = [...items, ...synMsg(event, next)];
    }

    return items;
  }

  if (res && res.data && res.data.errcode) {
    let message = res.data.errmsg.split(",")[0];
    throw new Exception(`${res.data.errcode} ${message}`, 400);
  }

  throw new Exception("Invalid request", 400);
}

function groupByUserID(items) {
  let groups = {};
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    let userid = item.event ? item.event.external_userid : item.external_userid;
    if (!groups[userid]) {
      groups[userid] = [];
    }
    groups[userid].push(item);
  }
  return groups;
}

function message(body) {
  var msg = body.split("<Encrypt><![CDATA[")[1];
  var msg = msg.split("]]></Encrypt>")[0];
  return msg;
}

function msgCursor() {
  let cfg = setting();
  let store = new Store("message");
  let cursor = store.Get(`wework_${cfg.corpid}_cursor`);
  return cursor;
}

function accessToken() {
  let cfg = setting();
  let store = new Store("message");
  let access_token = store.Get(`wework_${cfg.corpid}_access_token`);
  if (access_token != "" && access_token != null) {
    return access_token;
  }
  let url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${cfg.corpid}&corpsecret=${cfg.secret}`;
  let res = http.Get(url);

  if (res.code == 200 && res.data && res.data.errmsg == "ok") {
    access_token = res.data.access_token;
    store.Set(`wework_${cfg.corpid}_access_token`, access_token, 60 * 60 * 2);
    return access_token;
  }

  if (res && res.data && res.data.errcode) {
    let message = res.data.errmsg.split(",")[0];
    throw new Exception(`${res.data.errcode} ${message}`, 400);
  }

  throw new Exception("Invalid request", 400);
}
