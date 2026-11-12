const assert = require("node:assert/strict");
const { testPublicPages } = require("./public-pages");
const { testEmotionWorker } = require("./emotion-worker");

const { createPasswordRecord, verifyPassword } = require("../src/auth");
const { analyzeMessage, createAssistantReply, normalizeSupportMode } = require("../src/chat-engine");
const { selectEmotion } = require("../src/emotion-classifier");

const siteData = {
  site: {
    emergencyHotline: "全国统一心理援助热线 12356",
    emergencySecondary: "110 / 120"
  },
  safety: {
    crisisKeywords: ["不想活了", "结束自己"],
    trustedContactPrompt: "先联系一个此刻能赶到你身边的人。"
  },
  ai: {
    enabled: false
  }
};

const resources = [
  {
    id: "res-breathe",
    title: "焦虑急救卡",
    category: "焦虑",
    description: "帮助你先稳住呼吸。",
    steps: ["吸气", "呼气"],
    enabled: true
  },
  {
    id: "res-study",
    title: "学习重启卡",
    category: "学业",
    description: "帮助你缩小任务。",
    steps: ["只做 5 分钟"],
    enabled: true
  }
];

async function run() {
  const record = createPasswordRecord("admin123456");
  assert.equal(verifyPassword("admin123456", record.passwordSalt, record.passwordHash), true);
  assert.equal(verifyPassword("wrong-password", record.passwordSalt, record.passwordHash), false);

  const crisisAnalysis = analyzeMessage("我真的不想活了", siteData);
  assert.equal(crisisAnalysis.isCrisis, true);
  assert.equal(crisisAnalysis.label, "危机风险");
  assert.equal(normalizeSupportMode("unknown"), "listen");
  assert.equal(normalizeSupportMode("constructor"), "listen");
  assert.equal(selectEmotion({ label: "悲伤", score: 0.7, second: 0.03 }), "low");
  assert.equal(selectEmotion({ label: "高兴", score: 0.6, second: 0.05 }), null);
  assert.equal(selectEmotion({ label: "恐惧", score: 0.8, second: 0.72 }), null);
  assert.equal(selectEmotion({ label: "愤怒", score: 0.98, second: 0.01 }), null);

  const moodCases = [
    ["你好", "neutral"],
    ["晚上和朋友吃了饭", "neutral"],
    ["今天挺开心的", "positive"],
    ["我不开心", "neutral"],
    ["我没觉得难过，只是来确认一下时间。", "neutral"],
    ["这事谈不上焦虑。", "neutral"],
    ["我并不觉得特别紧张。", "neutral"],
    ["我没觉得自己很难过。", "neutral"],
    ["倒也不是不难过。", "low"],
    ["以前一到晚上就焦虑，现在不会紧张了。", "neutral"],
    ["以前很焦虑现在没事了", "neutral"],
    ["原来很焦虑，但这会儿只觉得累。", "burnout"],
    ["以前没觉得焦虑，但现在很紧张。", "anxiety"],
    ["刚收到好消息很高兴，但想到要上台还是很紧张。", "anxiety"],
    ["我没觉得难过，不过刚才看到照片还是有点难过。", "low"],
    ["昨天她没回我消息。", "relationship"],
    ["我没有焦虑，只是有点累", "burnout"],
    ["我不紧张了，刚刚松了口气", "positive"],
    ["在积累一些经验", "neutral"],
    ["我晚上总是睡不着", "insomnia"],
    ["跟朋友吵架以后一直没说话", "relationship"],
    ["好多事做不完，脑子很乱", "overwhelm"],
    ["今天有点难过", "low"]
  ];
  for (const [message, key] of moodCases) {
    assert.equal(analyzeMessage(message, siteData).key, key, message);
  }

  const listenReply = await createAssistantReply({
    message: "我明天考试，现在特别焦虑，完全看不进去。",
    conversation: { messages: [] },
    siteData,
    resources,
    supportMode: "listen"
  });

  assert.equal(listenReply.analysis.isCrisis, false);
  assert.match(listenReply.content, /最担心的是哪一件事/);
  assert.equal(listenReply.matchedResources.length > 0, true);

  const planReply = await createAssistantReply({
    message: "我明天考试，现在特别焦虑，完全看不进去。",
    conversation: { messages: [] },
    siteData,
    resources,
    supportMode: "plan"
  });

  assert.match(planReply.content, /一个你现在能确认的问题/);
  assert.equal(planReply.analysis.supportMode, "plan");

  const message = "我明天考试，现在有点紧张。";
  const localReply = (text, supportMode, messages = []) =>
    createAssistantReply({ message: text, conversation: { messages }, siteData, resources, supportMode });
  assert.match((await localReply(message, "sort")).content, /已经发生的/);
  assert.match((await localReply(message, "calm")).content, /脚底/);
  const first = await localReply(message, "listen");
  const history = [{ role: "user", content: message }, { role: "assistant", content: first.content }];
  assert.notEqual((await localReply(message, "listen", history)).content, first.content);
  const followUp = await localReply("嗯", "listen", [...history, { role: "user", content: "嗯" }]);
  assert.equal(followUp.analysis.key, "neutral");
  assert.match(followUp.content, /刚才那件事/);
  const crisisReply = await localReply("今天本来很开心，但我现在真的不想活了", "plan");
  assert.equal(crisisReply.analysis.isCrisis, true);
  assert.match(crisisReply.content, /12356/);

  await testPublicPages();
  await testEmotionWorker(siteData);
  console.log("All checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
