import { api, bindSiteName, escapeHtml, formatDate, registerServiceWorker, setInlineStatus } from "./shared.js";

const state = {
  dashboard: null,
  conversations: [],
  resources: [],
  settings: null
};

const adminApp = document.getElementById("adminApp");
const logoutBtn = document.getElementById("logoutBtn");
const conversationStatus = document.getElementById("conversationStatus");
const resourceStatus = document.getElementById("resourceStatus");
const settingsStatus = document.getElementById("settingsStatus");

function renderMetrics() {
  const metricsGrid = document.getElementById("metricsGrid");
  metricsGrid.innerHTML = state.dashboard.metrics
    .map(
      (item) => `
        <article class="surface-card stat-panel">
          <span class="card-topline">${item.label}</span>
          <strong>${item.value}</strong>
          <p>${item.hint}</p>
        </article>
      `
    )
    .join("");
}

function renderBarStack(containerId, items) {
  const container = document.getElementById(containerId);
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  container.innerHTML = items
    .map(
      (item) => `
        <div class="bar-row">
          <strong>${escapeHtml(item.label)}</strong>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(item.value / maxValue) * 100}%; background:${item.color};"></div>
          </div>
          <span>${item.value}</span>
        </div>
      `
    )
    .join("");
}

function renderRecentOverview() {
  document.getElementById("recentConversationList").innerHTML = state.dashboard.recentConversations.length
    ? state.dashboard.recentConversations
        .map(
          (item) => `
            <article class="admin-resource-card">
              <strong>${escapeHtml(item.summary)}</strong>
              <p>${escapeHtml(item.nickname)} · ${escapeHtml(item.lastMood)} · ${formatDate(item.updatedAt)}</p>
            </article>
          `
        )
        .join("")
    : `<div class="admin-resource-card"><p>还没有会话数据。</p></div>`;

  document.getElementById("recentCheckinList").innerHTML = state.dashboard.recentCheckins.length
    ? state.dashboard.recentCheckins
        .map(
          (item) => `
            <article class="checkin-mini-card">
              <strong>${escapeHtml(item.nickname || "匿名来访者")} · ${escapeHtml(item.mood)}</strong>
              <p>精力 ${item.energy}/10 · 压力 ${item.stress}/10</p>
              <p>${item.note ? escapeHtml(item.note) : "未填写补充内容"}</p>
            </article>
          `
        )
        .join("")
    : `<div class="admin-resource-card"><p>还没有签到数据。</p></div>`;

  renderBarStack("moodBars", state.dashboard.moodDistribution);
  renderBarStack("statusBars", state.dashboard.statusDistribution);
}

function renderConversations() {
  const conversationList = document.getElementById("conversationList");
  conversationList.innerHTML = state.conversations.length
    ? state.conversations
        .map(
          (conversation) => `
            <article class="conversation-card" data-conversation-id="${conversation.id}">
              <div class="conversation-card__head">
                <div>
                  <h3>${escapeHtml(conversation.summary)}</h3>
                  <div class="conversation-card__meta">
                    <span>${escapeHtml(conversation.nickname)}</span>
                    <span>${escapeHtml(conversation.lastMood)}</span>
                    <span>${formatDate(conversation.updatedAt)}</span>
                  </div>
                </div>
                <span class="resource-badge">${escapeHtml(conversation.status)}</span>
              </div>
              <label class="field">
                <span>状态</span>
                <select data-field="status">
                  <option value="open" ${conversation.status === "open" ? "selected" : ""}>open</option>
                  <option value="stable" ${conversation.status === "stable" ? "selected" : ""}>stable</option>
                  <option value="needs-followup" ${conversation.status === "needs-followup" ? "selected" : ""}>needs-followup</option>
                </select>
              </label>
              <label class="field">
                <span>管理员备注</span>
                <textarea data-field="adminNote" rows="3">${escapeHtml(conversation.adminNote || "")}</textarea>
              </label>
              <div class="conversation-preview">
                ${conversation.messages
                  .slice(-4)
                  .map(
                    (message) => `
                      <article>
                        <strong>${message.role === "user" ? "用户" : "心港"}</strong>
                        <div>${escapeHtml(message.content)}</div>
                      </article>
                    `
                  )
                  .join("")}
              </div>
              <div class="form-actions">
                <button class="button button-primary" type="button" data-action="save-conversation">保存这条会话</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="admin-resource-card"><p>还没有会话记录。</p></div>`;

  conversationList.querySelectorAll("[data-action='save-conversation']").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-conversation-id]");
      const conversationId = card.dataset.conversationId;
      const status = card.querySelector("[data-field='status']").value;
      const adminNote = card.querySelector("[data-field='adminNote']").value;

      try {
        await api(`/api/admin/conversations/${conversationId}`, {
          method: "PATCH",
          body: { status, adminNote }
        });
        setInlineStatus(conversationStatus, "会话更新成功。", "success");
        await loadConversations();
        await loadDashboard();
      } catch (error) {
        setInlineStatus(conversationStatus, error.message, "error");
      }
    });
  });
}

function fillResourceForm(resource = null) {
  document.getElementById("resourceId").value = resource?.id || "";
  document.getElementById("resourceTitle").value = resource?.title || "";
  document.getElementById("resourceCategory").value = resource?.category || "";
  document.getElementById("resourceDescription").value = resource?.description || "";
  document.getElementById("resourceSteps").value = resource?.steps?.join("\n") || "";
  document.getElementById("resourceEnabled").checked = resource ? resource.enabled !== false : true;
}

function renderResources() {
  const resourceAdminList = document.getElementById("resourceAdminList");
  resourceAdminList.innerHTML = state.resources.length
    ? state.resources
        .map(
          (resource) => `
            <article class="admin-resource-card">
              <div class="resource-card__head">
                <h3>${escapeHtml(resource.title)}</h3>
                <span class="resource-badge">${escapeHtml(resource.category)}</span>
              </div>
              <p>${escapeHtml(resource.description)}</p>
              <div class="resource-admin-actions">
                <button class="button button-secondary" type="button" data-action="edit-resource" data-id="${resource.id}">编辑</button>
                <button class="button button-secondary" type="button" data-action="delete-resource" data-id="${resource.id}">删除</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="admin-resource-card"><p>还没有资源卡片。</p></div>`;

  resourceAdminList.querySelectorAll("[data-action='edit-resource']").forEach((button) => {
    button.addEventListener("click", () => {
      const resource = state.resources.find((item) => item.id === button.dataset.id);
      fillResourceForm(resource);
      setInlineStatus(resourceStatus, `正在编辑：${resource.title}`, "info");
    });
  });

  resourceAdminList.querySelectorAll("[data-action='delete-resource']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/api/admin/resources/${button.dataset.id}`, { method: "DELETE" });
        setInlineStatus(resourceStatus, "资源已删除。", "success");
        await loadResources();
        await loadDashboard();
      } catch (error) {
        setInlineStatus(resourceStatus, error.message, "error");
      }
    });
  });
}

function renderSettings() {
  const { site, safety, ai, admin } = state.settings;
  bindSiteName({ site });
  document.title = `${site.name} | 后台管理`;
  document.getElementById("siteName").value = site.name || "";
  document.getElementById("siteTagline").value = site.tagline || "";
  document.getElementById("adminUsername").value = admin.username || "";
  document.getElementById("heroTitleInput").value = site.heroTitle || "";
  document.getElementById("heroTextInput").value = site.heroText || "";
  document.getElementById("chatGreetingInput").value = site.chatGreeting || "";
  document.getElementById("chatPlaceholderInput").value = site.chatPlaceholder || "";
  document.getElementById("footerNoteInput").value = site.footerNote || "";
  document.getElementById("emergencyHotlineInput").value = site.emergencyHotline || "";
  document.getElementById("emergencySecondaryInput").value = site.emergencySecondary || "";
  document.getElementById("crisisBannerInput").value = site.crisisBanner || "";
  document.getElementById("aiBaseUrl").value = ai.baseUrl || "";
  document.getElementById("aiModel").value = ai.model || "";
  document.getElementById("aiApiKey").value = "";
  document.getElementById("aiApiKey").placeholder = ai.hasApiKey ? "已保存，如需更换再输入新的 key" : "当前还没有设置 key";
  document.getElementById("aiApiKeyHint").textContent = ai.hasApiKey
    ? "当前已保存密钥。留空保存时不会覆盖原来的 key。"
    : "当前还没有保存密钥。输入后保存即可启用。";
  document.getElementById("aiEnabled").checked = Boolean(ai.enabled);
  document.getElementById("aiSystemPrompt").value = ai.systemPrompt || "";
  document.getElementById("crisisKeywordsInput").value = (safety.crisisKeywords || []).join("\n");
  document.getElementById("trustedContactPromptInput").value = safety.trustedContactPrompt || "";
  document.getElementById("newPasswordInput").value = "";
}

async function loadDashboard() {
  state.dashboard = await api("/api/admin/dashboard");
  renderMetrics();
  renderRecentOverview();
}

async function loadConversations() {
  const payload = await api("/api/admin/conversations");
  state.conversations = payload.conversations;
  renderConversations();
}

async function loadResources() {
  const payload = await api("/api/admin/resources");
  state.resources = payload.resources;
  renderResources();
}

async function loadSettings() {
  const payload = await api("/api/admin/settings");
  state.settings = payload.settings;
  renderSettings();
}

async function loadAllAdminData() {
  await Promise.all([loadDashboard(), loadConversations(), loadResources(), loadSettings()]);
}

function bindTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".admin-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `panel-${button.dataset.panel}`);
      });
    });
  });
}

function bindResourceForm() {
  document.getElementById("resourceResetBtn").addEventListener("click", () => {
    fillResourceForm();
    setInlineStatus(resourceStatus, "表单已清空。", "info");
  });

  document.getElementById("resourceForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const resourceId = document.getElementById("resourceId").value;
    const body = {
      title: document.getElementById("resourceTitle").value,
      category: document.getElementById("resourceCategory").value,
      description: document.getElementById("resourceDescription").value,
      steps: document.getElementById("resourceSteps").value,
      enabled: document.getElementById("resourceEnabled").checked
    };

    try {
      setInlineStatus(resourceStatus, "正在保存资源...", "info");
      if (resourceId) {
        await api(`/api/admin/resources/${resourceId}`, { method: "PATCH", body });
      } else {
        await api("/api/admin/resources", { method: "POST", body });
      }
      setInlineStatus(resourceStatus, "资源已保存。", "success");
      fillResourceForm();
      await loadResources();
      await loadDashboard();
    } catch (error) {
      setInlineStatus(resourceStatus, error.message, "error");
    }
  });
}

function bindSettingsForm() {
  document.getElementById("settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      site: {
        name: document.getElementById("siteName").value,
        tagline: document.getElementById("siteTagline").value,
        heroTitle: document.getElementById("heroTitleInput").value,
        heroText: document.getElementById("heroTextInput").value,
        chatGreeting: document.getElementById("chatGreetingInput").value,
        chatPlaceholder: document.getElementById("chatPlaceholderInput").value,
        footerNote: document.getElementById("footerNoteInput").value,
        emergencyHotline: document.getElementById("emergencyHotlineInput").value,
        emergencySecondary: document.getElementById("emergencySecondaryInput").value,
        crisisBanner: document.getElementById("crisisBannerInput").value
      },
      safety: {
        trustedContactPrompt: document.getElementById("trustedContactPromptInput").value,
        crisisKeywords: document
          .getElementById("crisisKeywordsInput")
          .value.split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
      },
      ai: {
        baseUrl: document.getElementById("aiBaseUrl").value,
        model: document.getElementById("aiModel").value,
        apiKey: document.getElementById("aiApiKey").value,
        enabled: document.getElementById("aiEnabled").checked,
        systemPrompt: document.getElementById("aiSystemPrompt").value
      },
      admin: {
        username: document.getElementById("adminUsername").value,
        newPassword: document.getElementById("newPasswordInput").value
      }
    };

    try {
      setInlineStatus(settingsStatus, "正在保存设置...", "info");
      const response = await api("/api/admin/settings", {
        method: "PATCH",
        body: payload
      });
      state.settings = response.settings;
      renderSettings();
      setInlineStatus(settingsStatus, "设置已保存。", "success");
    } catch (error) {
      setInlineStatus(settingsStatus, error.message, "error");
    }
  });
}

async function checkSession() {
  try {
    const payload = await api("/api/admin/session");
    if (!payload.authenticated) {
      window.location.replace("/admin-login");
      return;
    }
    adminApp.hidden = false;
    logoutBtn.hidden = false;
    await loadAllAdminData();
  } catch {
    window.location.replace("/admin-login");
  }
}

function bindLogout() {
  logoutBtn.addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST" });
    window.location.replace("/admin-login");
  });
}

async function init() {
  registerServiceWorker();
  bindTabs();
  bindLogout();
  bindResourceForm();
  bindSettingsForm();
  fillResourceForm();
  await checkSession();
}

init();
