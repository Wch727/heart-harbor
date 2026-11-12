import { api, bindSiteName, registerServiceWorker, setInlineStatus } from "./shared.js";
import { bindAiPresets } from "./ai-presets.js";

const logoutBtn = document.getElementById("logoutBtn");
const aiConfigApp = document.getElementById("aiConfigApp");
const aiConfigPanel = document.getElementById("aiConfigPanel");
const aiConfigStatus = document.getElementById("aiConfigStatus");

function renderSettings(settings) {
  bindSiteName({ site: settings.site });
  document.title = `${settings.site.name} | AI 接入配置`;
  document.getElementById("aiBaseUrl").value = settings.ai.baseUrl || "";
  document.getElementById("aiModel").value = settings.ai.model || "";
  document.getElementById("aiApiKey").value = "";
  document.getElementById("aiApiKey").placeholder = settings.ai.hasApiKey ? "已保存，如需更换再输入新的 key" : "当前还没有设置 key";
  document.getElementById("aiApiKeyHint").textContent = settings.ai.hasApiKey
    ? "当前已保存密钥。接口地址相同时，留空可沿用原密钥。"
    : "当前还没有保存密钥。输入后保存即可启用。";
  document.getElementById("aiEnabled").checked = Boolean(settings.ai.enabled);
  document.getElementById("aiSystemPrompt").value = settings.ai.systemPrompt || "";
}

async function loadSettings() {
  const payload = await api("/api/admin/settings");
  renderSettings(payload.settings);
}

function bindForm() {
  bindAiPresets(document.getElementById("aiPreset"), {
    baseUrlInput: document.getElementById("aiBaseUrl"),
    modelInput: document.getElementById("aiModel"),
    keyInput: document.getElementById("aiApiKey"),
    onSelect(preset, endpointChanged) {
      setInlineStatus(aiConfigStatus, `已填入 ${preset.label}。确认配置后保存。`, "info");
      if (endpointChanged) {
        document.getElementById("aiApiKey").placeholder = "输入新接口的 API Key";
        document.getElementById("aiApiKeyHint").textContent = "切换接口地址时，请填写对应的新密钥。";
      }
    }
  });

  document.getElementById("aiConfigForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      ai: {
        baseUrl: document.getElementById("aiBaseUrl").value,
        model: document.getElementById("aiModel").value,
        apiKey: document.getElementById("aiApiKey").value,
        enabled: document.getElementById("aiEnabled").checked,
        systemPrompt: document.getElementById("aiSystemPrompt").value
      }
    };

    try {
      setInlineStatus(aiConfigStatus, "正在保存 API 配置...", "info");
      const response = await api("/api/admin/settings", {
        method: "PATCH",
        body: payload
      });
      renderSettings(response.settings);
      setInlineStatus(aiConfigStatus, "API 配置已保存。", "success");
    } catch (error) {
      setInlineStatus(aiConfigStatus, error.message, "error");
    }
  });
}

function bindLogout() {
  logoutBtn.addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST" });
    window.location.replace("/admin-login");
  });
}

async function checkSession() {
  try {
    const payload = await api("/api/admin/session");
    if (!payload.authenticated) {
      window.location.replace("/admin-login");
      return false;
    }
    aiConfigApp.hidden = false;
    aiConfigPanel.hidden = false;
    logoutBtn.hidden = false;
    return true;
  } catch {
    window.location.replace("/admin-login");
    return false;
  }
}

async function init() {
  registerServiceWorker();
  bindLogout();
  bindForm();
  const ok = await checkSession();
  if (!ok) return;
  await loadSettings();
}

init();
