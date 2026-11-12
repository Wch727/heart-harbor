const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { PassThrough, Writable } = require("node:stream");
const { createAssistantReply } = require("../src/chat-engine");
const { classifyEmotion, startEmotionClassifier } = require("../src/emotion-classifier");

function mockWorker() {
  const child = new EventEmitter();
  const requests = [];
  child.stdout = new PassThrough();
  child.stdin = new Writable({
    write(chunk, _, done) {
      requests.push(JSON.parse(chunk));
      done();
    }
  });
  const respond = (value) => child.stdout.write(`${JSON.stringify(value)}\n`);
  return { child, requests, respond };
}

async function testEmotionWorker(siteData) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "heart-harbor-worker-"));
  const filenames = ["config.json", "vocab.txt", "pytorch_model.bin"];
  let mock;
  function start() {
    mock = mockWorker();
    startEmotionClassifier(directory, () => mock.child);
    return mock;
  }
  const reply = (message) => createAssistantReply({
    message, conversation: { messages: [] }, siteData, resources: [], supportMode: "listen"
  });
  const negative = { label: "悲伤", score: 0.93, second: 0.1 };

  try {
    await Promise.all(filenames.map((name) => fs.writeFile(path.join(directory, name), "")));

    let worker = start();
    assert.equal((await reply("我来确认一下时间。")).analysis.key, "neutral");
    assert.equal(worker.requests.length, 0);
    worker.child.emit("error", new Error("Missing Python executable"));
    assert.equal(await classifyEmotion("测试"), null);

    worker = start();
    worker.respond({ ready: true });
    assert.equal((await reply("我现在真的不想活了。")).analysis.isCrisis, true);
    assert.equal(worker.requests.length, 0);
    const first = classifyEmotion("第一条");
    const second = classifyEmotion("第二条");
    assert.equal(worker.requests.length, 2);
    const [firstRequest, secondRequest] = worker.requests;
    worker.respond({ id: secondRequest.id, label: "高兴", score: 0.9, second: 0.05 });
    worker.respond({ id: firstRequest.id, ...negative });
    assert.deepEqual(await Promise.all([first, second]), ["low", "positive"]);

    const unanswered = reply("我来确认一下时间。");
    assert.equal((await unanswered).analysis.key, "neutral");
    worker.respond({ id: worker.requests.at(-1).id, ...negative });

    const inputs = [
      ["想起以前的日子，眼泪就下来了。", "low"],
      ["我没觉得难过，只是来确认一下时间。", "neutral"],
      ["我原来挺难过的，现在没事了。", "neutral"]
    ];
    for (const [message, expected] of inputs) {
      const pending = reply(message);
      await Promise.resolve();
      assert.equal(worker.requests.at(-1).text, message);
      worker.respond({ id: worker.requests.at(-1).id, ...negative });
      const result = await pending;
      assert.equal(result.analysis.key, expected, message);
      assert.equal(result.analysis.emotionSource, expected === "low" ? "structbert-tiny" : undefined);
    }

    const inFlight = classifyEmotion("进程退出时还在等待");
    worker.child.emit("exit", 1);
    assert.equal(await inFlight, null);
    assert.equal((await reply("我来确认一下时间。")).analysis.key, "neutral");
    assert.equal(worker.requests.length, 7);
  } finally {
    mock?.child.emit("exit", 0);
    await Promise.all(filenames.map((name) => fs.rm(path.join(directory, name), { force: true })));
    await fs.rmdir(directory);
  }
}

module.exports = { testEmotionWorker };
