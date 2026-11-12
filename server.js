const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  clearAdminSession,
  ensureVisitorId,
  getAdminSession,
  issueAdminSession,
  verifyPassword,
  createPasswordRecord
} = require("./src/auth");
const {
  dataDirectory,
  ensureDataFiles,
  isCheckinMood,
  readData,
  sanitizePublicConfig,
  summarizeDashboard,
  timestamp,
  updateData,
  writeData
} = require("./src/data-store");
const { createAssistantReply, normalizeSupportMode, testRemoteAiConnection } = require("./src/chat-engine");
const { startEmotionClassifier } = require("./src/emotion-classifier");

const publicDirectory = path.join(process.cwd(), "public");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function redirect(response, location) {
  response.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store"
  });
  response.end();
}

function buildAdminSettingsPayload(siteData) {
  return {
    site: siteData.site,
    safety: siteData.safety,
    ai: {
      ...siteData.ai,
      apiKey: "",
      hasApiKey: Boolean(siteData.ai?.apiKey)
    },
    admin: {
      username: siteData.admin.username
    }
  };
}

async function parseJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("请求体不是合法的 JSON。");
  }
}

function slugifyText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .slice(0, 24);
}

function buildConversationSummary(messages, analysis) {
  const latestUserMessage = [...messages].reverse().find((item) => item.role === "user");
  const snippet = latestUserMessage?.content?.slice(0, 36) || "新的陪伴会话";
  return `${analysis.label} · ${snippet}${snippet.length >= 36 ? "…" : ""}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getLocalDateKey(dateValue) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLabelFromDateKey(dateKey) {
  const [, month, day] = dateKey.split("-");
  return `${month}-${day}`;
}

function average(items, key) {
  if (!items.length) return 0;
  return Math.round((items.reduce((sum, item) => sum + Number(item[key] || 0), 0) / items.length) * 10) / 10;
}

function buildTrendSeries(checkins, days) {
  const today = startOfToday();
  const points = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const dateKey = getLocalDateKey(date);
    const dayItems = checkins.filter((item) => getLocalDateKey(item.createdAt) === dateKey);
    const moodCountMap = dayItems.reduce((accumulator, item) => {
      accumulator[item.mood] = (accumulator[item.mood] || 0) + 1;
      return accumulator;
    }, {});
    const dominantMoodEntry = Object.entries(moodCountMap).sort((left, right) => right[1] - left[1])[0];

    points.push({
      dateKey,
      label: formatLabelFromDateKey(dateKey),
      count: dayItems.length,
      avgEnergy: average(dayItems, "energy"),
      avgStress: average(dayItems, "stress"),
      dominantMood: dominantMoodEntry ? dominantMoodEntry[0] : "暂无",
      dominantMoodColor: dominantMoodEntry ? ({
        平静: "#59c3a6",
        焦虑: "#ff8f70",
        疲惫: "#8aa4d4",
        失落: "#7b7fd8",
        委屈: "#f0b67f",
        麻木: "#8d99ae",
        开心: "#5bc0eb"
      }[dominantMoodEntry[0]] || "#8aa4d4") : "#d8c7bb"
    });
  }

  return points;
}

function buildMoodBreakdown(checkins) {
  return Object.entries(
    checkins.reduce((accumulator, item) => {
      accumulator[item.mood] = (accumulator[item.mood] || 0) + 1;
      return accumulator;
    }, {})
  )
    .map(([mood, count]) => ({ mood, count }))
    .sort((left, right) => right.count - left.count);
}

function buildInsightCopy({ weekCheckins, monthCheckins, weekSeries, monthSeries }) {
  if (!monthCheckins.length) {
    return {
      title: "还没有足够的记录",
      summary: "等你有几次签到之后，这里会开始慢慢看出属于你的情绪节奏。",
      suggestions: [
        "先连续签到几天，不用写很多，只要留下当下状态就行。",
        "如果你今天更想说出来，也可以直接去聊天页。",
        "你不需要每天都很完整，零碎记录也有价值。"
      ]
    };
  }

  const weekAvgStress = average(weekCheckins, "stress");
  const weekAvgEnergy = average(weekCheckins, "energy");
  const monthAvgStress = average(monthCheckins, "stress");
  const monthAvgEnergy = average(monthCheckins, "energy");
  const topMood = buildMoodBreakdown(monthCheckins)[0]?.mood || "复杂";
  const activeDaysInWeek = weekSeries.filter((item) => item.count > 0).length;

  let title = "这段时间你一直在认真撑着";
  let summary = `近 30 天里，你更常记录到「${topMood}」；最近 7 天平均压力 ${weekAvgStress}/10，平均精力 ${weekAvgEnergy}/10。`;
  const suggestions = [];

  if (weekAvgStress >= monthAvgStress + 1) {
    title = "这周像是明显更绷了一些";
    summary += "和近一个月相比，你这一周的压力在往上走，说明最近可能有更集中的消耗。";
    suggestions.push("这周先把目标收小一点，别要求自己一次恢复到满格。");
  } else if (weekAvgEnergy >= monthAvgEnergy + 1) {
    title = "这周比前阵子稍微回暖一点";
    summary += "和近一个月相比，你这周的精力有一点回升，说明你不是一直卡在原地。";
    suggestions.push("如果有一点回暖，可以先保住让你恢复的那几个小习惯。");
  } else {
    suggestions.push("你的状态像是在慢慢波动，而不是单向变坏，这很正常。");
  }

  if (weekAvgStress >= 7 && weekAvgEnergy <= 4) {
    suggestions.push("最近像是高压又低电量的组合，优先考虑休息和减负，不要只靠硬撑。");
  } else if (weekAvgStress <= 4 && weekAvgEnergy >= 6) {
    suggestions.push("最近几次签到里，你的身体和情绪有一些缓和空间，可以继续保持对自己温柔一点。");
  } else {
    suggestions.push("先继续记录几天，会更容易看清是短期波动还是某种固定节奏。");
  }

  if (activeDaysInWeek <= 2) {
    suggestions.push("这周记录还不多，晴雨表更像一个起点，后面会越来越像你自己的节奏图。");
  } else {
    suggestions.push("你这一周已经留下了几次痕迹，继续记下去，会更容易看见自己什么时候最容易累。");
  }

  return { title, summary, suggestions: suggestions.slice(0, 3) };
}

function buildCheckinInsights(checkins) {
  const sorted = [...checkins].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const now = Date.now();
  const weekCheckins = sorted.filter((item) => now - new Date(item.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const monthCheckins = sorted.filter((item) => now - new Date(item.createdAt).getTime() <= 30 * 24 * 60 * 60 * 1000);
  const weekSeries = buildTrendSeries(weekCheckins, 7);
  const monthSeries = buildTrendSeries(monthCheckins, 30);

  return {
    totalCount: sorted.length,
    weekCount: weekCheckins.length,
    monthCount: monthCheckins.length,
    latestMood: sorted[sorted.length - 1]?.mood || "暂无",
    latestNote: sorted[sorted.length - 1]?.note || "",
    weekAverage: {
      energy: average(weekCheckins, "energy"),
      stress: average(weekCheckins, "stress")
    },
    monthAverage: {
      energy: average(monthCheckins, "energy"),
      stress: average(monthCheckins, "stress")
    },
    weekSeries,
    monthSeries,
    moodBreakdown: buildMoodBreakdown(monthCheckins),
    insight: buildInsightCopy({ weekCheckins, monthCheckins, weekSeries, monthSeries })
  };
}

function getRouteMatch(pathname, pattern) {
  const routeParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (routeParts.length !== patternParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const routePart = routeParts[index];
    const patternPart = patternParts[index];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = routePart;
      continue;
    }
    if (routePart !== patternPart) return null;
  }

  return params;
}

function requireAdmin(request, response) {
  const session = getAdminSession(request);
  if (!session) {
    sendError(response, 401, "请先登录后台。");
    return null;
  }
  return session;
}

async function handlePublicBootstrap(response) {
  const siteData = await readData("site");
  sendJson(response, 200, { config: sanitizePublicConfig(siteData) });
}

async function handlePublicResources(response) {
  const resources = await readData("resources");
  sendJson(response, 200, {
    resources: resources.filter((item) => item.enabled)
  });
}

async function handlePublicTestAi(request, response) {
  const payload = await parseJsonBody(request);
  const siteData = await readData("site");
  const userAi = payload.userAi && typeof payload.userAi === "object" ? payload.userAi : null;

  if (!userAi?.baseUrl || !userAi?.model || !userAi?.apiKey) {
    sendError(response, 400, "请先填写完整的 Base URL、模型名和 API Key。");
    return;
  }

  try {
    const reply = await testRemoteAiConnection(siteData, {
      baseUrl: String(userAi.baseUrl || "").trim(),
      model: String(userAi.model || "").trim(),
      apiKey: String(userAi.apiKey || "").trim(),
      systemPrompt: String(userAi.systemPrompt || siteData.ai?.systemPrompt || "").trim()
    });

    sendJson(response, 200, {
      message: "连接成功。",
      reply
    });
  } catch (error) {
    sendError(response, 400, error.message || "连接失败。");
  }
}

async function handlePublicCheckin(request, response) {
  const visitorId = ensureVisitorId(request, response);
  const payload = await parseJsonBody(request);
  const nickname = String(payload.nickname || "匿名来访者").trim().slice(0, 24);
  const mood = typeof payload.mood === "string" ? payload.mood.trim() : "";
  const note = String(payload.note || "").trim().slice(0, 600);
  const energy = Number(payload.energy || 0);
  const stress = Number(payload.stress || 0);

  if (!isCheckinMood(mood)) {
    sendError(response, 400, "请从签到页提供的选项里选一个心情。");
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    visitorId,
    nickname: nickname || "匿名来访者",
    mood,
    note,
    energy: Number.isFinite(energy) ? Math.max(1, Math.min(10, energy)) : 5,
    stress: Number.isFinite(stress) ? Math.max(1, Math.min(10, stress)) : 5,
    createdAt: timestamp()
  };

  await updateData("checkins", (checkins) => checkins.unshift(entry));

  sendJson(response, 201, {
    message: "今天的心情记下来了。",
    checkin: entry
  });
}

async function handleCheckinInsights(request, response) {
  const visitorId = ensureVisitorId(request, response);
  const checkins = await readData("checkins");
  const ownCheckins = checkins.filter((item) => item.visitorId === visitorId);
  sendJson(response, 200, {
    insights: buildCheckinInsights(ownCheckins)
  });
}

async function handleChatHistory(request, response, url) {
  const visitorId = ensureVisitorId(request, response);
  const conversationId = url.searchParams.get("conversationId");

  if (!conversationId) {
    sendJson(response, 200, { conversation: null });
    return;
  }

  const conversations = await readData("conversations");
  const conversation = conversations.find((item) => item.id === conversationId && item.visitorId === visitorId);
  if (!conversation) {
    sendError(response, 404, "没有找到这段会话。");
    return;
  }

  sendJson(response, 200, { conversation });
}

async function handleChatDelete(request, response, url) {
  const visitorId = ensureVisitorId(request, response);
  const conversationId = url.searchParams.get("conversationId");
  const deleted = await updateData("conversations", (conversations) => {
    const index = conversations.findIndex((item) => item.id === conversationId && item.visitorId === visitorId);
    if (index === -1) return;
    conversations.splice(index, 1);
    return true;
  });
  if (!deleted) {
    sendError(response, 404, "没有找到这段会话。");
    return;
  }
  sendJson(response, 200, { message: "这段聊天已从站点删除。" });
}

async function handleChatMessage(request, response) {
  const visitorId = ensureVisitorId(request, response);
  const payload = await parseJsonBody(request);
  const message = String(payload.message || "").trim().slice(0, 1200);
  const nickname = String(payload.nickname || "访客").trim().slice(0, 24) || "访客";
  const requestedConversationId = String(payload.conversationId || "").trim();
  const supportMode = normalizeSupportMode(String(payload.supportMode || "").trim());
  const userAi = payload.userAi && typeof payload.userAi === "object" ? payload.userAi : null;

  if (!message) {
    sendError(response, 400, "请输入你想说的话。");
    return;
  }

  const [siteData, resources, conversations] = await Promise.all([
    readData("site"),
    readData("resources"),
    readData("conversations")
  ]);
  const runtimeSiteData = {
    ...siteData,
    ai: userAi?.enabled
      ? {
          ...siteData.ai,
          enabled: true,
          baseUrl: String(userAi.baseUrl || "").trim(),
          model: String(userAi.model || "").trim(),
          apiKey: String(userAi.apiKey || "").trim(),
          systemPrompt: String(userAi.systemPrompt || siteData.ai?.systemPrompt || "").trim()
        }
      : siteData.ai
  };

  let conversation =
    conversations.find((item) => item.id === requestedConversationId && item.visitorId === visitorId) || null;
  if (requestedConversationId && !conversation) {
    sendError(response, 404, "没有找到这段会话。可以重新开始，草稿会保留。");
    return;
  }
  if (!conversation) {
    conversation = {
      id: crypto.randomUUID(),
      visitorId,
      nickname,
      supportMode,
      status: "open",
      lastMood: "等待识别",
      summary: "新的陪伴会话",
      adminNote: "",
      matchedResourceIds: [],
      createdAt: timestamp(),
      updatedAt: timestamp(),
      messages: [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: siteData.site.chatGreeting,
          createdAt: timestamp()
        }
      ]
    };
  }

  const userMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: message,
    createdAt: timestamp()
  };

  const assistantResult = await createAssistantReply({
    message,
    conversation: { ...conversation, messages: [...conversation.messages, userMessage] },
    siteData: runtimeSiteData,
    resources,
    supportMode
  });

  const assistantMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: assistantResult.content,
    createdAt: timestamp()
  };
  const saved = await updateData("conversations", (latest) => {
    const current = requestedConversationId
      ? latest.find((item) => item.id === requestedConversationId && item.visitorId === visitorId)
      : conversation;
    if (!current) return;
    current.messages.push(userMessage, assistantMessage);
    current.nickname = nickname;
    current.supportMode = supportMode;
    current.updatedAt = timestamp();
    current.lastMood = assistantResult.analysis.label;
    if (assistantResult.analysis.isCrisis) current.status = "needs-followup";
    current.summary = buildConversationSummary(current.messages, assistantResult.analysis);
    current.matchedResourceIds = assistantResult.matchedResources.map((item) => item.id);
    if (!requestedConversationId) latest.unshift(current);
    return current;
  });
  if (!saved) {
    sendError(response, 404, "这段会话已经删除。可以重新开始，草稿会保留。");
    return;
  }

  sendJson(response, 200, {
    conversationId: saved.id,
    reply: assistantResult.content,
    analysis: assistantResult.analysis,
    matchedResources: assistantResult.matchedResources,
    conversation: saved
  });
}

async function handleAdminLogin(request, response) {
  const payload = await parseJsonBody(request);
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const siteData = await readData("site");

  if (
    username !== siteData.admin.username ||
    !verifyPassword(password, siteData.admin.passwordSalt, siteData.admin.passwordHash)
  ) {
    sendError(response, 401, "账号或密码错误。");
    return;
  }

  issueAdminSession(response, username);
  sendJson(response, 200, {
    message: "登录成功。",
    user: { username }
  });
}

function handleAdminEntry(request, response) {
  const session = getAdminSession(request);
  if (!session) {
    redirect(response, "/admin-login");
    return true;
  }
  return false;
}

function handleAdminLoginEntry(request, response) {
  const session = getAdminSession(request);
  if (session) {
    redirect(response, "/admin");
    return true;
  }
  return false;
}

function handleAdminSession(request, response) {
  const session = getAdminSession(request);
  if (!session) {
    sendJson(response, 200, { authenticated: false });
    return;
  }

  sendJson(response, 200, {
    authenticated: true,
    user: { username: session.username }
  });
}

function handleAdminLogout(request, response) {
  clearAdminSession(request, response);
  sendJson(response, 200, { message: "已退出后台。" });
}

async function handleAdminDashboard(request, response) {
  if (!requireAdmin(request, response)) return;

  const [checkins, conversations, resources] = await Promise.all([
    readData("checkins"),
    readData("conversations"),
    readData("resources")
  ]);

  sendJson(response, 200, summarizeDashboard(checkins, conversations, resources));
}

async function handleAdminConversations(request, response) {
  if (!requireAdmin(request, response)) return;
  const conversations = await readData("conversations");
  const sorted = [...conversations].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  sendJson(response, 200, { conversations: sorted });
}

async function handleAdminConversationUpdate(request, response, params) {
  if (!requireAdmin(request, response)) return;

  const payload = await parseJsonBody(request);
  const status = String(payload.status || "").trim();
  const adminNote = String(payload.adminNote || "").trim().slice(0, 1200);
  const conversation = await updateData("conversations", (conversations) => {
    const current = conversations.find((item) => item.id === params.id);
    if (!current) return;
    if (status) current.status = status;
    current.adminNote = adminNote;
    current.updatedAt = timestamp();
    return current;
  });

  if (!conversation) {
    sendError(response, 404, "会话不存在。");
    return;
  }

  sendJson(response, 200, {
    message: "会话已更新。",
    conversation
  });
}

async function handleAdminCheckins(request, response) {
  if (!requireAdmin(request, response)) return;
  const checkins = await readData("checkins");
  sendJson(response, 200, {
    checkins: [...checkins].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  });
}

async function handleAdminResources(request, response) {
  if (!requireAdmin(request, response)) return;
  const resources = await readData("resources");
  sendJson(response, 200, { resources });
}

async function handleAdminCreateResource(request, response) {
  if (!requireAdmin(request, response)) return;

  const payload = await parseJsonBody(request);
  const title = String(payload.title || "").trim().slice(0, 60);
  if (!title) {
    sendError(response, 400, "资源标题不能为空。");
    return;
  }

  const resource = {
    id: `res-${slugifyText(title) || crypto.randomUUID().slice(0, 8)}`,
    title,
    category: String(payload.category || "通用").trim().slice(0, 20) || "通用",
    description: String(payload.description || "").trim().slice(0, 180),
    steps: Array.isArray(payload.steps)
      ? payload.steps.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : String(payload.steps || "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 6),
    enabled: payload.enabled !== false,
    updatedAt: timestamp()
  };

  const resources = await readData("resources");
  resources.unshift(resource);
  await writeData("resources", resources);

  sendJson(response, 201, {
    message: "资源已创建。",
    resource
  });
}

async function handleAdminUpdateResource(request, response, params) {
  if (!requireAdmin(request, response)) return;

  const payload = await parseJsonBody(request);
  const resources = await readData("resources");
  const resource = resources.find((item) => item.id === params.id);
  if (!resource) {
    sendError(response, 404, "资源不存在。");
    return;
  }

  resource.title = String(payload.title || resource.title).trim().slice(0, 60) || resource.title;
  resource.category = String(payload.category || resource.category).trim().slice(0, 20) || resource.category;
  resource.description = String(payload.description || resource.description).trim().slice(0, 180);
  resource.steps = Array.isArray(payload.steps)
    ? payload.steps.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
    : String(payload.steps || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6);
  resource.enabled = payload.enabled !== false;
  resource.updatedAt = timestamp();
  await writeData("resources", resources);

  sendJson(response, 200, {
    message: "资源已更新。",
    resource
  });
}

async function handleAdminDeleteResource(request, response, params) {
  if (!requireAdmin(request, response)) return;
  const resources = await readData("resources");
  const nextResources = resources.filter((item) => item.id !== params.id);
  await writeData("resources", nextResources);
  sendJson(response, 200, { message: "资源已删除。" });
}

async function handleAdminSettings(request, response) {
  if (!requireAdmin(request, response)) return;
  const siteData = await readData("site");
  sendJson(response, 200, {
    settings: buildAdminSettingsPayload(siteData)
  });
}

async function handleAdminUpdateSettings(request, response) {
  const session = requireAdmin(request, response);
  if (!session) return;

  const payload = await parseJsonBody(request);
  const siteData = await readData("site");

  siteData.site = {
    ...siteData.site,
    ...payload.site
  };
  siteData.safety = {
    ...siteData.safety,
    ...payload.safety
  };
  const nextAi = {
    ...siteData.ai,
    ...payload.ai
  };
  const submittedApiKey =
    typeof payload.ai?.apiKey === "string" ? String(payload.ai.apiKey).trim() : undefined;
  const previousBaseUrl = String(siteData.ai.baseUrl || "").trim().replace(/\/+$/, "");
  const nextBaseUrl = String(nextAi.baseUrl || "").trim().replace(/\/+$/, "");
  const endpointChanged = previousBaseUrl !== nextBaseUrl;
  if (endpointChanged && nextAi.enabled && !submittedApiKey) {
    sendError(response, 400, "切换接口地址时，请填写新接口的 API Key。");
    return;
  }
  nextAi.apiKey = submittedApiKey || (endpointChanged ? "" : siteData.ai.apiKey);
  siteData.ai = nextAi;

  if (payload.admin?.username) {
    siteData.admin.username = String(payload.admin.username).trim().slice(0, 30) || siteData.admin.username;
  }
  if (payload.admin?.newPassword) {
    const nextPassword = String(payload.admin.newPassword).trim();
    if (nextPassword.length < 8) {
      sendError(response, 400, "新密码至少需要 8 位。");
      return;
    }
    Object.assign(siteData.admin, createPasswordRecord(nextPassword));
  }

  siteData.updatedAt = timestamp();
  await writeData("site", siteData);

  sendJson(response, 200, {
    message: "设置已保存。",
    settings: buildAdminSettingsPayload(siteData)
  });
}

async function serveStatic(response, pathname) {
  const rewrites = {
    "/": "/index.html",
    "/chat": "/chat.html",
    "/support": "/support.html",
    "/checkin": "/checkin.html",
    "/mood-weather": "/mood-weather.html",
    "/user-api": "/user-api.html",
    "/cards": "/cards.html",
    "/privacy": "/privacy.html",
    "/admin": "/admin.html",
    "/ai-config": "/ai-config.html",
    "/admin-login": "/admin-login.html"
  };

  const requestedPath = rewrites[pathname] || pathname;
  const relativePath = decodeURIComponent(requestedPath).replace(/^\/+/, "");
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDirectory, normalizedPath);

  if (!filePath.startsWith(publicDirectory)) {
    sendError(response, 403, "禁止访问。");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    response.end(file);
  } catch {
    sendError(response, 404, "页面不存在。");
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/public/bootstrap") return await handlePublicBootstrap(response);
    if (request.method === "GET" && url.pathname === "/api/public/resources") return await handlePublicResources(response);
    if (request.method === "GET" && url.pathname === "/api/public/checkin-insights") return await handleCheckinInsights(request, response);
    if (request.method === "POST" && url.pathname === "/api/public/test-ai") return await handlePublicTestAi(request, response);
    if (request.method === "POST" && url.pathname === "/api/public/checkin") return await handlePublicCheckin(request, response);
    if (request.method === "GET" && url.pathname === "/api/chat/history") return await handleChatHistory(request, response, url);
    if (request.method === "DELETE" && url.pathname === "/api/chat/history") return await handleChatDelete(request, response, url);
    if (request.method === "POST" && url.pathname === "/api/chat/message") return await handleChatMessage(request, response);

    if (request.method === "POST" && url.pathname === "/api/admin/login") return await handleAdminLogin(request, response);
    if (request.method === "GET" && url.pathname === "/api/admin/session") return handleAdminSession(request, response);
    if (request.method === "POST" && url.pathname === "/api/admin/logout") return handleAdminLogout(request, response);
    if (request.method === "GET" && url.pathname === "/api/admin/dashboard") return await handleAdminDashboard(request, response);
    if (request.method === "GET" && url.pathname === "/api/admin/conversations") return await handleAdminConversations(request, response);
    if (request.method === "GET" && url.pathname === "/api/admin/checkins") return await handleAdminCheckins(request, response);
    if (request.method === "GET" && url.pathname === "/api/admin/resources") return await handleAdminResources(request, response);
    if (request.method === "POST" && url.pathname === "/api/admin/resources") return await handleAdminCreateResource(request, response);
    if (request.method === "GET" && url.pathname === "/api/admin/settings") return await handleAdminSettings(request, response);
    if (request.method === "PATCH" && url.pathname === "/api/admin/settings") return await handleAdminUpdateSettings(request, response);

    const conversationParams = getRouteMatch(url.pathname, "/api/admin/conversations/:id");
    if (conversationParams && request.method === "PATCH") return await handleAdminConversationUpdate(request, response, conversationParams);

    const resourceParams = getRouteMatch(url.pathname, "/api/admin/resources/:id");
    if (resourceParams && request.method === "PATCH") return await handleAdminUpdateResource(request, response, resourceParams);
    if (resourceParams && request.method === "DELETE") return await handleAdminDeleteResource(request, response, resourceParams);

    if (url.pathname.startsWith("/api/")) {
      sendError(response, 404, "接口不存在。");
      return;
    }

    if (request.method === "GET" && url.pathname === "/admin") {
      if (handleAdminEntry(request, response)) return;
    }

    if (request.method === "GET" && url.pathname === "/ai-config") {
      if (handleAdminEntry(request, response)) return;
    }

    if (request.method === "GET" && url.pathname === "/admin-login") {
      if (handleAdminLoginEntry(request, response)) return;
    }

    if (request.method === "GET" && url.pathname === "/mood-weather") {
      await serveStatic(response, "/mood-weather.html");
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    sendError(response, 500, error.message || "服务器开小差了。");
  }
}

async function start() {
  await ensureDataFiles();
  const server = http.createServer(handleRequest);
  server.listen(port, () => {
    console.log(`Emotional companion site is running on http://localhost:${server.address().port}`);
    const modelDir = process.env.COMPANION_EMOTION_MODEL_DIR || path.join(dataDirectory, "models", "structbert-tiny");
    startEmotionClassifier(modelDir);
  });
}

start();
