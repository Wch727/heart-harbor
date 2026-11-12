const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

async function run() {
  const tempRoot = await fs.realpath(os.tmpdir());
  const dataDirectory = await fs.mkdtemp(path.join(tempRoot, "heart-harbor-records-"));
  const replies = [];
  const waiting = [];
  const mock = http.createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      const reply = () => {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ choices: [{ message: { content: "今天可以慢慢来。" } }] }));
      };
      const next = waiting.shift();
      if (next) next(reply);
      else replies.push(reply);
    });
  });
  mock.listen(0, "127.0.0.1");
  let server;
  try {
    await once(mock, "listening");
    const upstream = `http://127.0.0.1:${mock.address().port}`;
    async function takeReply() {
      if (replies.length) return replies.shift();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Mock model did not receive a request.")), 5000);
        waiting.push((reply) => {
          clearTimeout(timer);
          resolve(reply);
        });
      });
    }
    server = spawn(process.execPath, ["server.js"], {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, PORT: "0", COMPANION_DATA_DIR: dataDirectory },
      stdio: ["ignore", "pipe", "inherit"]
    });
    const [startup] = await once(server.stdout, "data", { signal: AbortSignal.timeout(10000) });
    const port = String(startup).match(/localhost:(\d+)/)?.[1];
    assert.ok(port);

    async function request(route, { method = "GET", cookie, body } = {}) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        body: body && JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
      });
      return { status: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0], body: await response.json() };
    }

    const insightsPath = "/api/public/checkin-insights";
    const [{ cookie: alice }, { cookie: bob }] = await Promise.all([request(insightsPath), request(insightsPath)]);
    assert.ok(alice && bob && alice !== bob);
    const checkin = (mood) => request("/api/public/checkin", { method: "POST", cookie: alice, body: { mood, energy: 5, stress: 5 } });
    const invalid = await checkin("私有文字");
    assert.equal(invalid.status, 400);
    const checkins = await Promise.all(Array.from({ length: 8 }, () => checkin("平静")));
    assert.ok(checkins.every((item) => item.status === 201));
    assert.equal((await request(insightsPath, { cookie: alice })).body.insights.totalCount, 8);
    assert.equal((await request(insightsPath, { cookie: bob })).body.insights.totalCount, 0);
    assert.deepEqual(Object.keys((await request("/api/public/bootstrap")).body), ["config"]);

    function chat(cookie, message, conversationId = "", hold = false) {
      return request("/api/chat/message", {
        method: "POST",
        cookie,
        body: { message, conversationId, userAi: hold ? { enabled: true, baseUrl: upstream, model: "mock", apiKey: "mock" } : undefined }
      });
    }

    const history = (id, cookie, method = "GET") => request(`/api/chat/history?conversationId=${id}`, { cookie, method });
    const pendingAlice = chat(alice, "今天读了一本书。", "", true);
    const finishAlice = await takeReply();
    const pendingBob = chat(bob, "今天去了公园。", "", true);
    const finishBob = await takeReply();
    finishBob();
    const bobChat = await pendingBob;
    assert.equal(bobChat.status, 200);
    finishAlice();
    const aliceChat = await pendingAlice;
    assert.equal(aliceChat.status, 200);
    const aliceId = aliceChat.body.conversationId;
    const bobId = bobChat.body.conversationId;
    assert.equal((await history(bobId, bob)).status, 200);

    const first = chat(alice, "书里有个有趣的故事。", aliceId, true);
    const finishFirst = await takeReply();
    const second = chat(alice, "我还写了一点笔记。", aliceId, true);
    const finishSecond = await takeReply();
    finishSecond();
    assert.equal((await second).status, 200);
    finishFirst();
    assert.equal((await first).status, 200);
    const messages = (await history(aliceId, alice)).body.conversation.messages;
    assert.equal(messages.length, 7);
    assert.ok(messages.some((message) => message.content === "书里有个有趣的故事。"));
    assert.ok(messages.some((message) => message.content === "我还写了一点笔记。"));

    assert.equal((await history(aliceId, bob, "DELETE")).status, 404);
    assert.equal((await history(aliceId, alice)).status, 200);
    const pendingDelete = chat(alice, "我准备出门了。", aliceId, true);
    const finishDeleted = await takeReply();
    assert.equal((await history(aliceId, alice, "DELETE")).status, 200);
    finishDeleted();
    assert.equal((await pendingDelete).status, 404);
    assert.equal((await history(aliceId, alice)).status, 404);
    assert.equal((await chat(alice, "试着发一条新消息。", aliceId)).status, 404);
    assert.equal((await history(bobId, bob)).status, 200);
    assert.equal((await request(insightsPath, { cookie: alice })).body.insights.totalCount, 8);
    console.log("Record integration checks passed.");
  } finally {
    if (server && server.exitCode === null && server.signalCode === null) {
      const closed = once(server, "close");
      server.kill();
      await closed;
    }
    mock.closeAllConnections();
    await new Promise((resolve) => mock.close(resolve));
    if (path.dirname(dataDirectory) === tempRoot && path.basename(dataDirectory).startsWith("heart-harbor-records-")) {
      await fs.rm(dataDirectory, { recursive: true, force: true });
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
