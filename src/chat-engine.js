const { classifyEmotion } = require("./emotion-classifier");

const categoryRules = [
  {
    key: "anxiety",
    label: "焦虑",
    categories: ["焦虑", "学业"],
    keywords: ["焦虑", "慌", "紧张", "担心", "不安", "来不及", "压力很大", "压力太大", "压力大"],
    opening: "这件事让你有点放心不下。",
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
    opening: "听起来你已经很累了，连开始做点什么都费劲。",
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
    keywords: ["睡不着", "失眠", "睡不好", "难入睡", "入睡困难", "一夜没睡", "半夜醒", "反复醒"],
    opening: "想睡却睡不好，确实磨人。",
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
    keywords: ["吵架", "冷战", "误会", "没回我", "不回我", "不理我", "被忽视", "分手", "闹别扭", "闹矛盾"],
    opening: "这段相处里，好像有些事还留在你心里。",
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
    keywords: ["崩溃", "好多事", "做不完", "卡住", "拖延", "内耗", "脑子乱", "脑子很乱", "心里乱", "顾不过来", "开始不了"],
    opening: "几件事挤在一起，光是想从哪儿开始就挺费劲。",
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
    opening: "听起来，这会儿心里有点沉。",
    steps: [
      "先给这种感受起个名字，例如难过、委屈、失望。",
      "做一件能证明你在照顾自己的小动作，比如喝水、洗脸、换衣服。",
      "如果愿意，给一个值得信任的人发一句简短消息。"
    ]
  }
];

const neutralRule = { key: "neutral", label: "还在了解", categories: [], steps: [], opening: "" };
const positiveRule = { key: "positive", label: "开心", categories: [], steps: [], opening: "" };
const positiveKeywords = ["开心", "高兴", "快乐", "满足", "松了口气", "好消息", "心情很好", "挺顺利"];
const shortAcknowledgment = /^(嗯+|哦+|好|好的|对|是啊|是的|还是那样|还是这样|说不清)[。！!…\s]*$/;
const greeting = /^(你好|嗨|哈喽|hello|hi)[。！!\s]*$/;

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
  return Object.hasOwn(supportModes, mode) ? mode : "listen";
}

const emotionNegation = /(?:并?不(?:太|再|怎么)?|并?没(?:有|那么|怎么)?|谈不上|算不上|不是|并非)(?:很|太|特别|那么)?(?:会|容易)?(?:觉得|感觉(?:到)?|感到|有)?(?:自己)?(?:很|太|特别|那么|有点)?$/;
const doubleEmotionNegation = /(?:不是|并非)(?:不|没)$/;
const emotionTimeShift = /(?:以前|原来|之前|刚才|起初)[^。！？!?]*?(?:[，,；;。]\s*)?(?:(?:但(?:是)?|不过|可是)\s*)?(?:现在|如今|这会儿|此刻)/;

function hasEmotionKeyword(text, keyword, negated = false) {
  let start = text.indexOf(keyword);
  while (start !== -1) {
    const prefix = text.slice(0, start);
    const denied = emotionNegation.test(prefix) && !doubleEmotionNegation.test(prefix);
    if (denied === negated) return true;
    start = text.indexOf(keyword, start + keyword.length);
  }
  return false;
}

function currentEmotionText(text) {
  const transition = emotionTimeShift.exec(text);
  return transition ? text.slice(transition.index + transition[0].length) : text;
}

function findRule(text) {
  const normalized = currentEmotionText(normalizeText(text)).replace(/积累|累积|累计|累赘|连累/g, " ");

  const scored = categoryRules
    .map((rule) => ({
      rule,
      score: rule.keywords.reduce((total, keyword) => total + Number(hasEmotionKeyword(normalized, keyword)), 0)
    }))
    .sort((left, right) => right.score - left.score);

  if (scored[0]?.score > 0) return scored[0].rule;
  if (positiveKeywords.some((keyword) => hasEmotionKeyword(normalized, keyword))) return positiveRule;
  return neutralRule;
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
    tags: matchedCrisisKeyword ? ["需要真人帮助", "优先保证安全"] : rule.key === "neutral" ? [] : [rule.label],
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

const localPrompts = {
  anxiety: { listen: "你最担心的是哪一件事？", sort: "可以先分开两件事：已经发生的，和你担心接下来会发生的。哪边更让你挂心？", plan: "先写下最担心的一件事，看看里面有没有一个你现在能确认的问题。" },
  burnout: { listen: "今天哪一段最耗你的力气？", sort: "想做却没力气，和有力气却不想做，听起来很像。你这会儿更接近哪一种？", plan: "看看今天有没有一件事可以改到明天。能少做一件，就先给自己留点余地。" },
  insomnia: { listen: "躺下以后，最让你睡不着的是什么？", sort: "是很久睡不着，还是睡着后容易醒？可以先说更困扰你的那个。", plan: "如果有一件明天要办的事一直在脑子里转，可以把它写下来，留到明天再看。" },
  relationship: { listen: "这件事里，哪句话或哪个瞬间让你最在意？", sort: "我们可以先从你确定发生的一件事说起。对方当时说了什么，或者做了什么？", plan: "如果想和对方说点什么，可以先把最想让对方听懂的一句话写在草稿里，等会儿再决定要不要发。" },
  overwhelm: { listen: "要是只挑一件说说，哪件事最占你的心思？", sort: "可以先把手头的事分成今天得处理的、可以晚点再看的。第一类里有哪一件？", plan: "从最急的一件事里挑一个能马上开始的动作，比如打开文件、写个标题。先做到这里就够了。" },
  low: { listen: "要是想说说，今天哪一刻最不好受？", sort: "可以先回想一下，这种感觉是在一件事之后冒出来的，还是今天一直都在？", plan: "如果你想让身边的人知道，可以只发一句「今天有点难过，方便陪我说几句吗？」" }
};

const calmPrompt = "如果方便，可以把脚放在地上，留意一下脚底踩着的地方。坐一会儿，按你平常的节奏呼吸就好。";

function buildLocalReply(message, analysis, conversation, mode) {
  const text = normalizeText(message);
  const history = conversation?.messages || [];
  const lastReply = history.findLast((item) => item.role === "assistant")?.content;
  const priorUserMessage = history.findLast((item) => item.role === "user" && normalizeText(item.content) !== text);
  const continuing = Boolean(priorUserMessage);
  let reply;

  if (analysis.key === "positive") {
    reply = "听起来今天有件让你开心的事。你最想记住的是哪一刻？";
  } else if (shortAcknowledgment.test(text) && continuing) {
    reply = "可以慢慢想。要是还想聊刚才那件事，想到哪儿就从哪儿说。";
  } else if (greeting.test(text)) {
    reply = "你好呀。今天有什么想聊的？";
  } else if (analysis.key === "neutral") {
    reply = {
      listen: "你可以从今天的一件小事说起，也可以说说现在是什么心情。",
      sort: "我们从一件具体的事开始吧。你想先理一理哪件事？",
      calm: calmPrompt,
      plan: "你现在最想做成哪一件小事？知道是什么之后，我们再挑一个能开始的动作。"
    }[mode];
  } else {
    const prompt = mode === "calm" ? calmPrompt : localPrompts[analysis.key][mode];
    reply = `${analysis.opening}${prompt}`;
  }

  if (reply !== lastReply) return reply;
  if (analysis.key === "positive") return "这份高兴也值得多说两句。如果愿意，可以讲讲当时发生了什么。";
  return {
    listen: "刚才提到的事，有没有哪个细节是你还想多说两句的？",
    sort: "刚才那个问题如果不好答，也可以先说说你已经确定的一点。",
    calm: "可以先停一会儿。等你想接着说时，再告诉我现在感觉怎么样。",
    plan: "如果刚才那一步还是有点难，我们可以再缩小一点。是从哪里开始最费劲？"
  }[mode];
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
  const hostname = URL.canParse(endpoint) ? new URL(endpoint).hostname : "";
  const model = ai.model.trim().toLowerCase();
  if (["api.moonshot.cn", "api.moonshot.ai"].includes(hostname) &&
      ["kimi-k3.1-pro", "kimi-k3.1-pro-highspeed"].includes(model)) {
    requestBody.reasoning_effort = "low";
    requestBody.max_tokens = 2048;
  }
  if (hostname === "api.deepseek.com" && ["deepseek-flash", "deepseek-v4-pro"].includes(model)) {
    requestBody.thinking = { type: "disabled" };
  }
  if (hostname === "api.openai.com" && model.startsWith("gpt-6")) {
    delete requestBody.max_tokens;
    requestBody.max_completion_tokens = 2048;
    requestBody.reasoning_effort = "low";
  }
  if (hostname === "generativelanguage.googleapis.com" && model.startsWith("gemini-3")) {
    requestBody.max_tokens = 2048;
    requestBody.reasoning_effort = "low";
  }
  if (hostname === "dashscope.aliyuncs.com" && model.startsWith("qwen3.8-")) {
    requestBody.enable_thinking = false;
  }
  if (hostname === "open.bigmodel.cn" && model === "glm-5.3") {
    requestBody.reasoning_effort = "low";
    requestBody.max_tokens = 2048;
  }
  if (hostname === "api.minimax.io" && model === "minimax-m3.1-flash") {
    delete requestBody.max_tokens;
    requestBody.max_completion_tokens = 2048;
    requestBody.reasoning_effort = "low";
    requestBody.reasoning_split = true;
  }
  if (["api.anthropic.com", "api.x.ai", "api.xiaomimimo.com", "ark.cn-beijing.volces.com",
    "qianfan.baidubce.com", "api.mistral.ai", "openrouter.ai"].includes(hostname)) {
    requestBody.max_tokens = 2048;
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
  let analysis = analyzeMessage(message, siteData);
  const activeMode = normalizeSupportMode(supportMode);
  const modeFields = { supportMode: activeMode, supportModeLabel: supportModes[activeMode].label };

  if (analysis.isCrisis) {
    return {
      content: `${analysis.opening}\n\n请你现在就做这三件事：\n${analysis.steps
        .map((step, index) => `${index + 1}. ${step}`)
        .join("\n")}\n\n等你先把第一步做到位了，再回来告诉我一声，我会继续陪你往下走。`,
      analysis: { ...analysis, ...modeFields },
      matchedResources: pickResources(resources, analysis)
    };
  }

  let fallbackReason;
  try {
    const aiReply = await callRemoteAi(siteData, conversation, message, analysis, activeMode);
    if (aiReply) {
      return {
        content: aiReply,
        analysis: { ...analysis, ...modeFields },
        matchedResources: pickResources(resources, analysis)
      };
    }
  } catch (error) {
    fallbackReason = error.message;
  }

  const text = normalizeText(message);
  if (analysis.key === "neutral" && !shortAcknowledgment.test(text) && !greeting.test(text)) {
    const key = await classifyEmotion(message);
    const rule = key === "positive" ? positiveRule : categoryRules.find((item) => item.key === key);
    const keywords = key === "positive" ? positiveKeywords : rule?.keywords;
    const currentText = currentEmotionText(text);
    const contradictsText = keywords?.some((keyword) =>
      hasEmotionKeyword(currentText, keyword, true) ||
      (currentText !== text && hasEmotionKeyword(text.slice(0, text.length - currentText.length), keyword))
    );
    if (rule && !contradictsText) {
      const { label, categories, steps, opening } = rule;
      analysis = { ...analysis, key, label, categories, steps, opening, tags: [label], emotionSource: "structbert-tiny" };
    }
  }

  return {
    content: buildLocalReply(message, analysis, conversation, activeMode),
    analysis: {
      ...analysis,
      ...modeFields,
      ...(fallbackReason === undefined ? {} : { fallbackReason })
    },
    matchedResources: pickResources(resources, analysis)
  };
}

module.exports = {
  analyzeMessage,
  createAssistantReply,
  normalizeSupportMode,
  supportModes,
  testRemoteAiConnection
};
