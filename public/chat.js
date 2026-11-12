import { api, bindSiteFields, bindSiteName, escapeHtml, formatDate, registerServiceWorker, setInlineStatus } from "./shared.js";

const STORAGE_KEY = "companion-active-conversation";
const SUPPORT_MODE_KEY = "companion-support-mode";
const USER_API_STORAGE_KEY = "companion-user-api-config";
const chatFeed = document.getElementById("chatFeed");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const nicknameInput = document.getElementById("nicknameInput");
const chatStatus = document.getElementById("chatStatus");
const matchedResources = document.getElementById("matchedResources");
const analysisTitle = document.getElementById("analysisTitle");
const analysisText = document.getElementById("analysisText");
const analysisTags = document.getElementById("analysisTags");
const conversationMeta = document.getElementById("conversationMeta");
const chatSafetyCard = document.getElementById("chatSafetyCard");
const chatSafetyDetails = document.getElementById("chatSafetyDetails");
const supportModeHint = document.getElementById("supportModeHint");
const supportModeBadge = document.getElementById("supportModeBadge");
const modeSceneNote = document.getElementById("modeSceneNote");
const composerNote = document.getElementById("composerNote");
const activeApiIndicator = document.getElementById("activeApiIndicator");

const supportModeMeta = {
  listen: {
    label: "先听我说",
    emptyTitle: "从你最想说的那一点开始",
    emptyText: "不用讲完整，也不用急着讲明白。你先说，我跟着你。",
    hint: "适合想先被听见的时候。",
    sceneNote: "这会儿我们先不急着分析，先把你接住。",
    composerNote: "短短一句也可以。比如 “我今天真的有点撑不住了”。"
  },
  sort: {
    label: "帮我理清",
    emptyTitle: "我们先把乱线头理出来",
    emptyText: "你说一点，我帮你捋一点。不急着下结论，也不急着证明谁对谁错。",
    hint: "适合脑子很乱、一直在回放的时候。",
    sceneNote: "这会儿我们先把缠在一起的线头轻轻理开。",
    composerNote: "你可以从 “发生了什么 / 我最难受的是什么” 里任选一句开始。"
  },
  calm: {
    label: "带我缓缓",
    emptyTitle: "先让自己松下来一点",
    emptyText: "这次先不解决问题，先让呼吸和身体慢慢落地。",
    hint: "适合很绷、很慌的时候。",
    sceneNote: "这会儿先不用想太多，我们先让身体慢下来。",
    composerNote: "如果你现在连组织语言都累，可以只发一句 “我现在很慌”。"
  },
  plan: {
    label: "给我下一步",
    emptyTitle: "只找一个够轻的下一步",
    emptyText: "不用把整件事想完，我们先找一个你现在做得动的小动作。",
    hint: "适合只想知道下一步的时候。",
    sceneNote: "这会儿我们不求一下想明白，只找眼前能做的一小步。",
    composerNote: "你可以直接说 “你帮我拆一个最小版本出来”。"
  }
};

const state = {
  conversationId: localStorage.getItem(STORAGE_KEY) || "",
  conversation: null,
  config: null,
  supportMode: "listen",
  userApi: null
};

function readUserApiConfig() {
  try {
    return JSON.parse(localStorage.getItem(USER_API_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function hasCompleteUserApiConfig(config = null) {
  return Boolean(config?.enabled && config.baseUrl && config.model && config.apiKey);
}

function normalizeSupportMode(mode = "") {
  return supportModeMeta[mode] ? mode : "listen";
}

function renderSupportModeUI() {
  document.querySelectorAll("[data-support-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.supportMode === state.supportMode);
  });

  supportModeHint.textContent = supportModeMeta[state.supportMode].hint;
  if (supportModeBadge) supportModeBadge.textContent = supportModeMeta[state.supportMode].label;
  if (modeSceneNote) modeSceneNote.textContent = supportModeMeta[state.supportMode].sceneNote;
  if (composerNote) composerNote.textContent = supportModeMeta[state.supportMode].composerNote;
}

function setSupportMode(mode, options = {}) {
  state.supportMode = normalizeSupportMode(mode);
  localStorage.setItem(SUPPORT_MODE_KEY, state.supportMode);
  renderSupportModeUI();

  if (!options.silent) {
    renderAnalysis(null);
    renderConversationMeta();
  }
}

function humanizeStatus(status) {
  if (status === "stable") return "这段话已经慢慢稳下来一点";
  if (status === "needs-followup") return "现在先让真人陪在你身边";
  return "我们还在顺着这段话慢慢往下走";
}

function renderSafetyState(isCrisis = false) {
  chatSafetyCard.hidden = !isCrisis;
  if (isCrisis) {
    chatSafetyCard.classList.add("is-urgent");
    chatSafetyDetails.open = true;
  } else {
    chatSafetyCard.classList.remove("is-urgent");
    chatSafetyDetails.open = false;
  }
}

function renderEmptyState() {
  chatFeed.innerHTML = `
    <div class="message-empty message-empty-rich">
      <span class="message-empty__eyebrow">今晚先从这里开始</span>
      <strong class="message-empty__title">如果你不知道怎么开口，就先挑一句最像你的。</strong>
      <p>你不用把事情整理清楚了再说。先有第一句，后面的我们再慢慢来。</p>
      <div class="starter-inline-grid">
        <button type="button" class="starter-inline-chip" data-inline-starter="我现在脑子特别乱，像一团线缠在一起。">我现在脑子特别乱</button>
        <button type="button" class="starter-inline-chip" data-inline-starter="我今天一直很绷，明明累了却还是停不下来。">我今天一直很绷</button>
        <button type="button" class="starter-inline-chip" data-inline-starter="我也不知道怎么说，但就是有点撑不住了。">我有点撑不住了</button>
      </div>
    </div>
  `;

  chatFeed.querySelectorAll("[data-inline-starter]").forEach((button) => {
    button.addEventListener("click", async () => {
      const starter = button.dataset.inlineStarter || "";
      if (!starter) return;
      messageInput.value = starter;
      await sendMessage(starter);
      messageInput.value = "";
    });
  });
}

function renderMessages() {
  const messages = state.conversation?.messages || [];
  const userLabel = state.conversation?.nickname?.trim() || "你";
  if (!messages.length) {
    renderEmptyState();
    return;
  }

  chatFeed.innerHTML = messages
    .map(
      (message) => `
        <article class="message-row ${message.role === "user" ? "user" : "assistant"}">
          <div class="message-bubble">
            <small>${message.role === "user" ? escapeHtml(userLabel) : "我"}</small>
            <p>${escapeHtml(message.content)}</p>
          </div>
        </article>
      `
    )
    .join("");

  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function renderMatchedResources(resources = []) {
  matchedResources.innerHTML = resources.length
    ? resources
        .map(
          (item) => `
            <article class="admin-resource-card">
              <div class="resource-card__head">
                <h3>${escapeHtml(item.title)}</h3>
                <span class="resource-badge">${escapeHtml(item.category)}</span>
              </div>
              <p>${escapeHtml(item.description)}</p>
            </article>
          `
        )
        .join("")
    : `<div class="admin-resource-card"><p>等你多说一点，如果你愿意，我会在这里放几张更贴近你现在状态的支持卡。</p></div>`;
}

function renderConversationMeta(analysis) {
  const conversation = state.conversation;
  conversationMeta.innerHTML = `
    <div><strong>目前的节奏</strong><span>${escapeHtml(humanizeStatus(conversation?.status))}</span></div>
    <div><strong>最后更新</strong><span>${conversation ? formatDate(conversation.updatedAt) : "等待第一条消息"}</span></div>
    <div><strong>当前摘要</strong><span>${escapeHtml(conversation?.summary || "发出第一条消息后，这里会留下当前这一段的进度")}</span></div>
    <div><strong>你现在选的方式</strong><span>${escapeHtml(supportModeMeta[state.supportMode].label)}</span></div>
    <div><strong>我此刻听出来的是</strong><span>${escapeHtml(analysis?.label || conversation?.lastMood || "等待识别")}</span></div>
  `;
}

function renderAnalysis(analysis) {
  if (!analysis) {
    analysisTitle.textContent = supportModeMeta[state.supportMode].emptyTitle;
    analysisText.textContent = supportModeMeta[state.supportMode].emptyText;
    analysisTags.innerHTML = "";
    renderSafetyState(false);
    return;
  }

  analysisTitle.textContent = analysis.isCrisis ? "先别一个人扛" : analysis.label;
  analysisText.textContent = analysis.isCrisis
    ? "这会儿先不讲道理，也不急着分析。先把你的安全放在最前面，再决定下一步。"
    : `听起来，你现在更像是在经历「${analysis.label}」。如果你愿意，我们先只管眼前这一小步：${analysis.steps?.[0] || "先稳住，再慢慢往下走。"}`;
  analysisTags.innerHTML = (analysis.tags || []).map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("");
  renderSafetyState(analysis.isCrisis);
}

function renderPrivacyNote() {
  const privacyNote = document.getElementById("chatPrivacyNote");
  if (!privacyNote || !state.config) return;

  privacyNote.textContent = state.config.privacy?.aiEnabled
    ? "你可以匿名来，这段对话不会公开展示；如果站点启用了在线 AI，内容会发送到管理员配置的模型接口，并保存在这台电脑的本地私有目录里。"
    : "你可以匿名来，这段对话不会公开展示；当前主要保存在这台电脑的本地私有目录里。";
  if (hasCompleteUserApiConfig(state.userApi)) {
    privacyNote.textContent += " 当前聊天会优先使用你在“我的 API”里保存的本机配置。";
  }
}

function renderActiveApiIndicator() {
  if (!activeApiIndicator) return;
  if (hasCompleteUserApiConfig(state.userApi)) {
    activeApiIndicator.textContent = `当前使用：我的 API · ${state.userApi.model}`;
    return;
  }
  if (state.userApi?.enabled) {
    activeApiIndicator.textContent = "当前使用：等待你补全本机 API";
    return;
  }
  if (state.config?.privacy?.aiEnabled) {
    activeApiIndicator.textContent = "当前使用：站点默认 API";
    return;
  }
  activeApiIndicator.textContent = "当前使用：站点本地模式";
}

function refreshUserApiState() {
  state.userApi = readUserApiConfig();
  renderPrivacyNote();
  renderActiveApiIndicator();
}

async function loadBootstrap() {
  const payload = await api("/api/public/bootstrap");
  state.config = payload.config;
  bindSiteName(payload.config);
  bindSiteFields({
    emergencyHotline: payload.config.site.emergencyHotline,
    emergencySecondary: payload.config.site.emergencySecondary,
    crisisBanner: payload.config.site.crisisBanner
  });
  document.title = `${payload.config.site.name} | 今晚先慢慢说`;
  messageInput.placeholder = payload.config.site.chatPlaceholder;
  renderPrivacyNote();
  renderActiveApiIndicator();
}

async function loadHistory() {
  if (!state.conversationId) {
    renderEmptyState();
    renderMatchedResources([]);
    renderConversationMeta();
    renderAnalysis(null);
    return;
  }

  try {
    const payload = await api(`/api/chat/history?conversationId=${encodeURIComponent(state.conversationId)}`);
    state.conversation = payload.conversation;
    if (state.conversation?.supportMode) setSupportMode(state.conversation.supportMode, { silent: true });
    renderMessages();
    renderMatchedResources([]);
    renderConversationMeta();
    renderSafetyState(state.conversation?.status === "needs-followup");
  } catch {
    state.conversationId = "";
    localStorage.removeItem(STORAGE_KEY);
    state.conversation = null;
    renderEmptyState();
    renderMatchedResources([]);
    renderConversationMeta();
    renderAnalysis(null);
    renderSafetyState(false);
  }
}

async function sendMessage(message) {
  if (!message.trim()) return;

  try {
    setInlineStatus(chatStatus, "我在认真看，等我一下。", "info");
    const payload = await api("/api/chat/message", {
      method: "POST",
      body: {
        conversationId: state.conversationId,
        nickname: nicknameInput.value.trim(),
        message,
        supportMode: state.supportMode,
        userAi: state.userApi
      }
    });

    state.conversationId = payload.conversationId;
    state.conversation = payload.conversation;
    if (state.conversation?.supportMode) setSupportMode(state.conversation.supportMode, { silent: true });
    localStorage.setItem(STORAGE_KEY, state.conversationId);
    renderMessages();
    renderAnalysis(payload.analysis);
    renderMatchedResources(payload.matchedResources);
    renderConversationMeta(payload.analysis);
    setInlineStatus(
      chatStatus,
      payload.analysis.isCrisis ? "现在先把安全放在最前面。" : "我回你了。如果你愿意，可以接着往下说。",
      payload.analysis.isCrisis ? "error" : "success"
    );
  } catch (error) {
    setInlineStatus(chatStatus, error.message, "error");
  }
}

function bindStarters() {
  document.querySelectorAll(".starter-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const starter = button.dataset.starter || "";
      messageInput.value = starter;
      await sendMessage(starter);
      messageInput.value = "";
    });
  });
}

function bindSupportModes() {
  document.querySelectorAll("[data-support-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      setSupportMode(button.dataset.supportMode);
    });
  });
}

function resetConversation() {
  state.conversationId = "";
  state.conversation = null;
  localStorage.removeItem(STORAGE_KEY);
  renderEmptyState();
  renderAnalysis(null);
  renderMatchedResources([]);
  renderConversationMeta();
  renderSafetyState(false);
  setInlineStatus(chatStatus, "这段我们先放下。你想重新开始，也可以。", "info");
}

function clearLocalTrace() {
  state.conversationId = "";
  state.conversation = null;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SUPPORT_MODE_KEY);
  document.cookie = "companion_visitor_id=; Max-Age=0; Path=/; SameSite=Lax";
  nicknameInput.value = "";
  messageInput.value = "";
  setSupportMode("listen", { silent: true });
  renderEmptyState();
  renderAnalysis(null);
  renderMatchedResources([]);
  renderConversationMeta();
  renderSafetyState(false);
  setInlineStatus(chatStatus, "本机上的会话痕迹已经清掉了。下次打开会从新的访客状态开始。", "success");
}

async function init() {
  registerServiceWorker();
  refreshUserApiState();
  const modeFromQuery = new URLSearchParams(window.location.search).get("mode");
  const storedMode = localStorage.getItem(SUPPORT_MODE_KEY);
  setSupportMode(modeFromQuery || storedMode || "listen", { silent: true });
  bindStarters();
  bindSupportModes();
  document.getElementById("resetConversationBtn").addEventListener("click", resetConversation);
  document.getElementById("clearLocalTraceBtn").addEventListener("click", clearLocalTrace);

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;
    await sendMessage(message);
    messageInput.value = "";
  });

  window.addEventListener("storage", (event) => {
    if (event.key === USER_API_STORAGE_KEY) {
      refreshUserApiState();
    }
  });

  window.addEventListener("focus", refreshUserApiState);

  try {
    await loadBootstrap();
    await loadHistory();
  } catch (error) {
    setInlineStatus(chatStatus, `页面打开时出了点小问题：${error.message}`, "error");
  }
}

init();
