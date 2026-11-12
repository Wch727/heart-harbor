const assert = require("node:assert/strict");
const { testPublicPages } = require("./public-pages");

const { createPasswordRecord, verifyPassword } = require("../src/auth");
const { analyzeMessage, createAssistantReply, normalizeSupportMode } = require("../src/chat-engine");

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

  const listenReply = await createAssistantReply({
    message: "我明天考试，现在特别焦虑，完全看不进去。",
    conversation: { messages: [] },
    siteData,
    resources,
    supportMode: "listen"
  });

  assert.equal(listenReply.analysis.isCrisis, false);
  assert.match(listenReply.content, /这次我先不急着给办法/);
  assert.equal(listenReply.matchedResources.length > 0, true);

  const planReply = await createAssistantReply({
    message: "我明天考试，现在特别焦虑，完全看不进去。",
    conversation: { messages: [] },
    siteData,
    resources,
    supportMode: "plan"
  });

  assert.match(planReply.content, /今晚不求解决全部/);
  assert.equal(planReply.analysis.supportMode, "plan");

  await testPublicPages();
  console.log("All checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
