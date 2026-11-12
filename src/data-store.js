const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const { createPasswordRecord } = require("./auth");

const projectDataDirectory = path.join(process.cwd(), "data");
const dataDirectory = process.env.COMPANION_DATA_DIR
  ? path.resolve(process.env.COMPANION_DATA_DIR)
  : process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "HeartHarbor")
    : path.join(os.homedir(), ".heart-harbor");
const logsDirectory = path.join(dataDirectory, "logs");
const writeQueues = new Map();

const moodPalette = {
  平静: "#59c3a6",
  焦虑: "#ff8f70",
  疲惫: "#8aa4d4",
  失落: "#7b7fd8",
  委屈: "#f0b67f",
  麻木: "#8d99ae",
  开心: "#5bc0eb"
};

function timestamp() {
  return new Date().toISOString();
}

function buildDefaultSiteData() {
  const adminPassword = createPasswordRecord("admin123456");

  return {
    site: {
      name: "心港",
      tagline: "先接住情绪，再陪你往前走",
      heroTitle: "在这儿坐一会儿吧。",
      heroText:
        "想说的话，可以从今天的一件小事说起。今天没什么想说的，也可以点点水面，看一圈涟漪慢慢散开。",
      chatGreeting:
        "可以从今天的一件小事说起。想到哪儿，就说到哪儿。",
      chatPlaceholder: "比如，今天回家路上，我一直在想一件事。",
      footerNote:
        "如果你觉得自己现在不安全，请联系一个能来陪你的人。",
      emergencyHotline: "全国统一心理援助热线 12356",
      emergencySecondary: "如果你已经觉得自己不太安全，先联系身边能到场的人，再考虑继续聊天。",
      crisisBanner: "如果你已经有伤害自己或他人的冲动，请先找真人陪在你身边，再来处理别的。"
    },
    safety: {
      hotline: "12356",
      emergencyNumbers: "110 / 120",
      trustedContactPrompt: "优先联系此刻能赶到你身边的人，例如家人、室友、朋友或老师。",
      crisisKeywords: [
        "不想活了",
        "不想活",
        "结束自己",
        "自杀",
        "伤害自己",
        "轻生",
        "活着没意义",
        "撑不下去",
        "想消失"
      ]
    },
    ai: {
      enabled: false,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      apiKey: "",
      systemPrompt:
        "你是中文情感陪伴助手。先接住用户情绪，再给出 1 到 3 个具体可执行的小动作；避免空泛说教。遇到自伤或他伤风险时，优先引导用户联系真人和紧急援助。"
    },
    admin: {
      username: "admin",
      ...adminPassword
    },
    updatedAt: timestamp()
  };
}

function buildDefaultResources() {
  return [
    {
      id: "res-breathe",
      title: "3 分钟焦虑急救",
      category: "焦虑",
      description: "适合心跳快、脑子乱、很想立刻逃开的时刻。",
      steps: [
        "双脚踩地，慢慢吸气 4 秒，呼气 6 秒，连续做 5 轮。",
        "说出你此刻能看见的 3 个东西，让注意力回到现实。",
        "把接下来 15 分钟只保留一件最重要的小事。"
      ],
      enabled: true,
      updatedAt: timestamp()
    },
    {
      id: "res-sleep",
      title: "夜间安抚流程",
      category: "失眠",
      description: "适合深夜停不下来的反刍和失眠状态。",
      steps: [
        "先把最刺激的信息源关掉 10 分钟。",
        "给脑子一个出口，把担心写成三条短句。",
        "告诉自己：今晚只负责休息，不在夜里做重大决定。"
      ],
      enabled: true,
      updatedAt: timestamp()
    },
    {
      id: "res-study",
      title: "学习停摆重启",
      category: "学业",
      description: "适合拖延、卡住、越想做越难开始的情形。",
      steps: [
        "先判断是太累了，还是害怕开始。",
        "把任务缩到 5 分钟版本，例如只读一页、只写标题。",
        "完成后停 30 秒，再决定要不要继续。"
      ],
      enabled: true,
      updatedAt: timestamp()
    },
    {
      id: "res-relationship",
      title: "关系冲突复盘卡",
      category: "关系",
      description: "适合吵架、误会、被忽视之后脑内反复回放。",
      steps: [
        "先分开事实、猜测和感受，不要混在一起。",
        "问自己：我真正希望被理解的是什么？",
        "如果要沟通，只说一件最核心的事。"
      ],
      enabled: true,
      updatedAt: timestamp()
    },
    {
      id: "res-burnout",
      title: "精力见底时的保底清单",
      category: "疲惫",
      description: "适合什么都不想动、整个人塌下来的时候。",
      steps: [
        "先补水、洗脸、换姿势，让身体收到一点点照顾。",
        "今天只保留一件必须做的事，其余都延后。",
        "如果还要继续做事，先给自己一个 20 分钟上限。"
      ],
      enabled: true,
      updatedAt: timestamp()
    },
    {
      id: "res-help",
      title: "向真人求助的开口模板",
      category: "求助",
      description: "适合不知道怎么求助、怕打扰别人的时候。",
      steps: [
        "先用一句话说明你现在状态不好。",
        "再说明你希望对方做什么，例如陪我待 10 分钟。",
        "如果对方不能帮，再换下一个人，不代表你不值得被接住。"
      ],
      enabled: true,
      updatedAt: timestamp()
    }
  ];
}

const datasets = {
  site: {
    directory: dataDirectory,
    fileName: "site.json",
    legacyFilePath: path.join(projectDataDirectory, "site.json"),
    createDefault: buildDefaultSiteData
  },
  resources: {
    directory: dataDirectory,
    fileName: "resources.json",
    legacyFilePath: path.join(projectDataDirectory, "resources.json"),
    createDefault: buildDefaultResources
  },
  checkins: {
    directory: logsDirectory,
    fileName: "checkins.json",
    legacyFilePath: path.join(projectDataDirectory, "logs", "checkins.json"),
    fallbackLegacyFilePath: path.join(projectDataDirectory, "checkins.json"),
    createDefault: () => []
  },
  conversations: {
    directory: logsDirectory,
    fileName: "conversations.json",
    legacyFilePath: path.join(projectDataDirectory, "logs", "conversations.json"),
    fallbackLegacyFilePath: path.join(projectDataDirectory, "conversations.json"),
    createDefault: () => []
  }
};

function getDatasetDirectory(dataset) {
  return dataset.directory || dataDirectory;
}

function getDatasetFilePath(dataset) {
  return path.join(getDatasetDirectory(dataset), dataset.fileName);
}

async function migrateLegacyLogFile(dataset) {
  const nextFilePath = getDatasetFilePath(dataset);
  try {
    await fs.access(nextFilePath);
    return;
  } catch {}

  const legacyCandidates = [dataset.legacyFilePath, dataset.fallbackLegacyFilePath].filter(Boolean);

  let sourcePath = "";
  for (const candidate of legacyCandidates) {
    try {
      await fs.access(candidate);
      sourcePath = candidate;
      break;
    } catch {}
  }
  if (!sourcePath) return;

  await fs.mkdir(path.dirname(nextFilePath), { recursive: true });
  await fs.rename(sourcePath, nextFilePath);
}

async function ensureDataFiles() {
  await fs.mkdir(projectDataDirectory, { recursive: true });
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.mkdir(logsDirectory, { recursive: true });

  for (const dataset of Object.values(datasets)) {
    await migrateLegacyLogFile(dataset);
    const datasetDirectory = getDatasetDirectory(dataset);
    const filePath = getDatasetFilePath(dataset);
    await fs.mkdir(datasetDirectory, { recursive: true });
    try {
      await fs.access(filePath);
    } catch {
      const defaultValue = dataset.createDefault();
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), "utf8");
    }
  }
}

async function readData(key) {
  await ensureDataFiles();
  const dataset = datasets[key];
  if (!dataset) throw new Error(`Unknown dataset: ${key}`);

  const filePath = getDatasetFilePath(dataset);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function queueWrite(key, operation) {
  const previousQueue = writeQueues.get(key) || Promise.resolve();
  const nextQueue = previousQueue.then(operation);
  writeQueues.set(key, nextQueue.catch(() => {}));
  return nextQueue;
}

async function replaceDataFile(key, value) {
  const filePath = getDatasetFilePath(datasets[key]);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function writeData(key, value) {
  await ensureDataFiles();
  if (!Object.hasOwn(datasets, key)) throw new Error(`Unknown dataset: ${key}`);
  const filePath = getDatasetFilePath(datasets[key]);
  return queueWrite(key, () => fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8"));
}

function updateData(key, update) {
  return queueWrite(key, async () => {
    const data = await readData(key);
    const result = update(data);
    if (result !== undefined) await replaceDataFile(key, data);
    return result;
  });
}

function sanitizePublicConfig(siteData) {
  return {
    site: siteData.site,
    safety: siteData.safety,
    privacy: {
      aiEnabled: Boolean(siteData.ai?.enabled)
    },
    updatedAt: siteData.updatedAt
  };
}

function summarizeDashboard(checkins, conversations, resources) {
  const sortedConversations = [...conversations].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
  const sortedCheckins = [...checkins].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const statusMap = {
    open: 0,
    stable: 0,
    "needs-followup": 0
  };
  for (const item of conversations) {
    statusMap[item.status] = (statusMap[item.status] || 0) + 1;
  }

  const moodDistribution = sortedCheckins.reduce((accumulator, item) => {
    const found = accumulator.find((entry) => entry.label === item.mood);
    if (found) {
      found.value += 1;
    } else {
      accumulator.push({
        label: item.mood,
        value: 1,
        color: moodPalette[item.mood] || "#8aa4d4"
      });
    }
    return accumulator;
  }, []);

  return {
    metrics: [
      { label: "累计会话", value: conversations.length, hint: "所有访客的对话总数" },
      { label: "待跟进会话", value: statusMap["needs-followup"] || 0, hint: "含危机提示或被标记的会话" },
      { label: "情绪签到", value: checkins.length, hint: "来自首页的签到记录" },
      { label: "已启用资源", value: resources.filter((item) => item.enabled).length, hint: "当前展示在前台的支持卡片" }
    ],
    recentConversations: sortedConversations.slice(0, 8),
    recentCheckins: sortedCheckins.slice(0, 8),
    moodDistribution: moodDistribution.sort((left, right) => right.value - left.value),
    statusDistribution: [
      { label: "开放中", value: statusMap.open || 0, color: "#5bc0eb" },
      { label: "稳定", value: statusMap.stable || 0, color: "#59c3a6" },
      { label: "需跟进", value: statusMap["needs-followup"] || 0, color: "#ff8f70" }
    ]
  };
}

module.exports = {
  dataDirectory,
  ensureDataFiles,
  isCheckinMood: (mood) => Object.hasOwn(moodPalette, mood),
  logsDirectory,
  projectDataDirectory,
  readData,
  sanitizePublicConfig,
  summarizeDashboard,
  timestamp,
  updateData,
  writeData
};
