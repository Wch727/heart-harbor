const categoryRules = [
  {
    key: "anxiety",
    label: "焦虑",
    categories: ["焦虑", "学业"],
    keywords: ["焦虑", "慌", "紧张", "担心", "不安", "考试", "deadline", "来不及", "压力"],
    opening: "我先接住你这股很紧、很想立刻逃开的感觉。你不是不行，只是神经已经绷得太久了。",
    steps: [
      "先把呼吸拉慢一点，吸气 4 秒，呼气 6 秒，连续做 5 轮。",
      "把你最担心的事缩成一句话，避免脑子里一团乱。",
      "接下来只保留 15 分钟内能完成的一件小事。"
    ]
  },
  {
    key: "burnout",
    label: "疲惫",
    categories: ["疲惫"],
    keywords: ["累", "疲惫", "没劲", "不想动", "撑不住", "麻木", "什么都不想做", "空掉"],
    opening: "听起来你不是不想做，而是真的被耗空了。现在最重要的不是逼自己振作，而是先让自己少再消耗一点。",
    steps: [
      "先补水、换个姿势、让身体感受到一点点被照顾。",
      "今天只保留一件必须做的事，其余先放过自己。",
      "如果还要继续做事，先设一个 20 分钟上限，不再硬扛。"
    ]
  },
  {
    key: "insomnia",
    label: "失眠",
    categories: ["失眠"],
    keywords: ["睡不着", "失眠", "凌晨", "夜里", "脑子停不下来", "半夜", "晚上"],
    opening: "深夜的时候，情绪会被放大很多。先别急着想通全部问题，我们只做降低唤醒这一步。",
    steps: [
      "把最刺激的信息源关掉 10 分钟，包括聊天和短视频。",
      "把脑子里的担心写成三条短句，写出来就先不继续想。",
      "提醒自己：今晚不做重大决定，只负责休息。"
    ]
  },
  {
    key: "relationship",
    label: "关系拉扯",
    categories: ["关系"],
    keywords: ["朋友", "对象", "家人", "吵架", "冷战", "误会", "关系", "聊天记录", "被忽视"],
    opening: "关系里的不舒服最容易让人反复回放。我们先把事情理清，再决定要不要回应。",
    steps: [
      "先分开事实、你的猜测和你的感受。",
      "问自己：我最希望被理解的是哪一句话。",
      "如果要沟通，只说一件最核心的事，不一次性倾倒全部情绪。"
    ]
  },
  {
    key: "overwhelm",
    label: "压得喘不过气",
    categories: ["学业", "疲惫"],
    keywords: ["崩溃", "好多事", "做不完", "卡住", "拖延", "内耗", "乱", "开始不了"],
    opening: "现在更像是事情太多，把你整个人压住了。我们不需要一下子把人生理顺，只先找一个切口。",
    steps: [
      "把所有任务写成三个词，不展开，不求完整。",
      "从里面挑最小、最不痛的一件，只做 5 分钟版本。",
      "做完以后再决定下一步，不要提前把整晚都吓到。"
    ]
  },
  {
    key: "low",
    label: "低落",
    categories: ["求助"],
    keywords: ["难过", "失落", "委屈", "沮丧", "想哭", "心情不好", "提不起劲", "孤单"],
    opening: "我在。你现在不用急着把自己劝好，先让这份难过被看见就已经很重要了。",
    steps: [
      "先给这种感受起个名字，例如难过、委屈、失望。",
      "做一件能证明你在照顾自己的小动作，比如喝水、洗脸、换衣服。",
      "如果愿意，给一个值得信任的人发一句简短消息。"
    ]
  }
];

const supportModes = {
  listen: {
    label: "先听我说",
    subcopy: "少一点建议，先接住我"
  },
  sort: {
    label: "帮我理清",
    subcopy: "把脑子里的乱线慢慢理顺"
  },
  calm: {
    label: "带我缓缓",
    subcopy: "先把身体和呼吸带回来"
  },
  plan: {
    label: "给我下一步",
    subcopy: "不用很多，只要够轻的半步"
  }
};

function normalizeText(text = "") {
  return String(text).trim().toLowerCase();
}

function normalizeSupportMode(mode = "") {
  return supportModes[mode] ? mode : "listen";
}

function findRule(text) {
  const normalized = normalizeText(text);

  const scored = categoryRules
    .map((rule) => ({
      rule,
      score: rule.keywords.reduce((total, keyword) => total + (normalized.includes(keyword.toLowerCase()) ? 1 : 0), 0)
    }))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.score > 0 ? scored[0].rule : categoryRules[0];
}

function analyzeMessage(text, siteData) {
  const normalized = normalizeText(text);
  const crisisKeywords = siteData.safety?.crisisKeywords || [];
  const matchedCrisisKeyword = crisisKeywords.find((keyword) => normalized.includes(keyword.toLowerCase()));
  const rule = findRule(text);

  return {
    label: matchedCrisisKeyword ? "危机风险" : rule.label,
    key: matchedCrisisKeyword ? "crisis" : rule.key,
    isCrisis: Boolean(matchedCrisisKeyword),
    tags: matchedCrisisKeyword ? ["需要真人帮助", "优先保证安全"] : [rule.label, "先稳住再处理"],
    steps: matchedCrisisKeyword
      ? [
          `先联系 ${siteData.site.emergencyHotline}，或者先去找一个能立刻到你身边的人。`,
          siteData.safety.trustedContactPrompt,
          "如果你身边有危险物品，请尽量离开现场并去到有人在的地方。"
        ]
      : rule.steps,
    categories: matchedCrisisKeyword ? ["求助"] : rule.categories,
    opening: matchedCrisisKeyword
      ? "你现在最重要的不是把话说清楚，而是先不要一个人扛。我希望你先去找一个真的能在场的人陪你。"
      : rule.opening
  };
}

function pickResources(resources, analysis) {
  const categories = new Set(analysis.categories);
  return resources
    .filter((item) => item.enabled && categories.has(item.category))
    .slice(0, 2);
}

function buildReflection(analysis) {
  const reflections = {
    anxiety: "像是心里一直绷着，越想越紧，脑子根本停不下来。",
    burnout: "像是整个人已经被耗住了，哪怕只是开始一下都很费劲。",
    insomnia: "像是夜里越安静，脑子反而越吵，很多东西停不下来。",
    relationship: "像是事情已经过去了，可心里还在一遍一遍回放那些细节。",
    overwhelm: "像是眼前的事挤成一团，连从哪里下手都变得很难。",
    low: "像是心里闷着一团东西，很想被理解一下，又不知道从哪说起。"
  };

  return reflections[analysis.key] || "像是心里有一团东西压着你，让你很难轻松下来。";
}

function buildResourceNudge(matchedResources, prefix = "如果你想") {
  if (!matchedResources.length) return "";
  return `\n\n${prefix}，我也可以带你试试「${matchedResources[0].title}」：${matchedResources[0].description}`;
}

function buildListenReply(analysis, matchedResources) {
  return [
    analysis.opening,
    "",
    "这次我先不急着给办法，先陪你把这团感受放到桌面上。",
    buildReflection(analysis),
    "",
    "如果你愿意，可以接着告诉我：这件事里，最让你难受的是哪一个瞬间，或者哪一句你最想被别人听懂的话？",
    buildResourceNudge(matchedResources, "如果等会儿你想要一点点工具")
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSortReply(analysis, matchedResources) {
  return [
    analysis.opening,
    "",
    "我们先不判断谁对谁错，只把这件事理清一点点。",
    "你可以只按这三个小格子来说：",
    "1. 发生了什么",
    "2. 你当下最真实的感受是什么",
    "3. 你现在最需要的到底是什么",
    "",
    "你愿意先从第一格开始，说一句就行。",
    buildResourceNudge(matchedResources, "如果你想按更有结构的方式来")
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCalmReply(analysis, matchedResources) {
  const steps = analysis.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  return [
    analysis.opening,
    "",
    "这会儿先不分析，我们先把身体带回来一点。",
    steps,
    "",
    "做完以后你只要告诉我一句：现在是心口、胃里，还是脑子最紧，我就接着陪你。",
    buildResourceNudge(matchedResources, "如果你想让我直接带着你做")
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPlanReply(message, analysis, matchedResources) {
  return [
    analysis.opening,
    "",
    "我们今晚不求解决全部，只求往前挪半步。",
    `先把“${message.slice(0, 18)}${message.length > 18 ? "…" : ""}”缩成一个 10 分钟版本。`,
    "你可以从这三个方向里挑一个：",
    "1. 先做最小的一步",
    "2. 先处理最急的一件",
    "3. 先休息 10 分钟，再回来继续",
    "",
    "如果你愿意，把你最想逃开的那件事发我一句，我帮你拆到更轻。",
    buildResourceNudge(matchedResources, "如果你想顺手借一张卡")
  ]
    .filter(Boolean)
    .join("\n");
}

function buildLocalReply(message, analysis, matchedResources, supportMode) {
  const mode = normalizeSupportMode(supportMode);

  if (mode === "sort") return buildSortReply(analysis, matchedResources);
  if (mode === "calm") return buildCalmReply(analysis, matchedResources);
  if (mode === "plan") return buildPlanReply(message, analysis, matchedResources);
  return buildListenReply(analysis, matchedResources);
}

function normalizeAiEndpoint(baseUrl = "") {
  const trimmed = baseUrl.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed.replace(/\/$/, "")}/chat/completions`;
}

function extractTextFromAiResponse(payload) {
  const message = payload?.choices?.[0]?.message?.content;
  if (typeof message === "string") return message.trim();
  if (Array.isArray(message)) {
    return message
      .map((item) => item?.text || item?.content || "")
      .join("")
      .trim();
  }
  return "";
}

function shouldFallbackFromAiReply(reply, analysis) {
  if (!reply) return true;
  if (analysis.isCrisis) return false;
  return /(热线|拨打|110|120|12356|急救|报警|心理援助)/.test(reply);
}

function isKimiK25Model(model = "") {
  return String(model).trim().toLowerCase() === "kimi-k2.5";
}

async function callRemoteAi(siteData, conversation, message, analysis, supportMode) {
  const { ai } = siteData;
  if (!ai?.enabled || !ai?.apiKey || !ai?.baseUrl || !ai?.model) return null;

  const endpoint = normalizeAiEndpoint(ai.baseUrl);
  if (!endpoint) return null;
  const activeMode = normalizeSupportMode(supportMode);
  const modeLabel = supportModes[activeMode].label;
  const recentConversationMessages = (conversation?.messages || []).slice(-8);
  const includesCurrentMessage =
    recentConversationMessages.length > 0 &&
    recentConversationMessages[recentConversationMessages.length - 1].role !== "assistant" &&
    recentConversationMessages[recentConversationMessages.length - 1].content === message;

  const recentMessages = recentConversationMessages.map((item) => ({
    role: item.role === "assistant" ? "assistant" : "user",
    content: item.content
  }));
  if (!includesCurrentMessage) {
    recentMessages.push({
      role: "user",
      content: message
    });
  }

  const requestBody = {
    model: ai.model,
    max_tokens: 160,
    messages: [
      {
        role: "system",
        content: `${ai.systemPrompt}\n当前识别到的情绪标签：${analysis.label}。\n用户当前更想要的陪伴方式：${modeLabel}。\n请像一个稳定、温柔、有分寸感的朋友一样说话，先接住感受，再轻轻往前带半步。\n除非当前内容明确涉及立刻自伤、他伤或现实中的紧急危险，否则不要主动提供热线、报警、医院、免责声明或危机处置话术。\n不要使用标题、列表、编号、markdown 加粗。\n请用自然中文回复，控制在 2 到 4 句、100 到 180 字之间。`
      },
      ...recentMessages
    ]
  };
  if (isKimiK25Model(ai.model)) {
    requestBody.thinking = { type: "disabled" };
    requestBody.temperature = 0.6;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ai.apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    const errorText = (await response.text()).trim();
    const safeErrorText = errorText ? `，${errorText.slice(0, 160)}` : "";
    throw new Error(`AI 接口请求失败：${response.status}${safeErrorText}`);
  }

  const payload = await response.json();
  const aiReply = extractTextFromAiResponse(payload).replace(/\*\*/g, "").trim();
  if (shouldFallbackFromAiReply(aiReply, analysis)) return "";
  return aiReply;
}

async function testRemoteAiConnection(siteData, aiOverride = null) {
  const runtimeSiteData = {
    ...siteData,
    ai: aiOverride
      ? {
          ...siteData.ai,
          ...aiOverride,
          enabled: true
        }
      : siteData.ai
  };

  const analysis = {
    label: "连接测试",
    key: "test",
    isCrisis: false,
    tags: [],
    steps: [],
    categories: [],
    opening: ""
  };

  const reply = await callRemoteAi(runtimeSiteData, { messages: [] }, "请用一句中文短句回复“连接成功”。", analysis, "listen");
  if (!reply) {
    throw new Error("接口没有返回有效内容。");
  }
  return reply;
}

async function createAssistantReply({ message, conversation, siteData, resources, supportMode }) {
  const analysis = analyzeMessage(message, siteData);
  const matchedResources = pickResources(resources, analysis);
  const activeMode = normalizeSupportMode(supportMode);

  if (analysis.isCrisis) {
    return {
      content: `${analysis.opening}\n\n请你现在就做这三件事：\n${analysis.steps
        .map((step, index) => `${index + 1}. ${step}`)
        .join("\n")}\n\n等你先把第一步做到位了，再回来告诉我一声，我会继续陪你往下走。`,
      analysis: {
        ...analysis,
        supportMode: activeMode,
        supportModeLabel: supportModes[activeMode].label
      },
      matchedResources
    };
  }

  try {
    const aiReply = await callRemoteAi(siteData, conversation, message, analysis, activeMode);
    if (aiReply) {
      return {
        content: aiReply,
        analysis: {
          ...analysis,
          supportMode: activeMode,
          supportModeLabel: supportModes[activeMode].label
        },
        matchedResources
      };
    }
  } catch (error) {
    return {
      content: buildLocalReply(message, analysis, matchedResources, activeMode),
      analysis: {
        ...analysis,
        supportMode: activeMode,
        supportModeLabel: supportModes[activeMode].label,
        fallbackReason: error.message
      },
      matchedResources
    };
  }

  return {
    content: buildLocalReply(message, analysis, matchedResources, activeMode),
    analysis: {
      ...analysis,
      supportMode: activeMode,
      supportModeLabel: supportModes[activeMode].label
    },
    matchedResources
  };
}

module.exports = {
  analyzeMessage,
  createAssistantReply,
  normalizeSupportMode,
  supportModes,
  testRemoteAiConnection
};
