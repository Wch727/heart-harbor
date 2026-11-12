import { api, bindSiteName, registerServiceWorker, setInlineStatus } from "./shared.js";
import { bindAiPresets } from "./ai-presets.js";

const USER_API_STORAGE_KEY = "companion-user-api-config";
const userApiStatus = document.getElementById("userApiStatus");
let siteConfig = null;

function readUserApiConfig() {
  try {
    return JSON.parse(localStorage.getItem(USER_API_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeUserApiConfig(value) {
  localStorage.setItem(USER_API_STORAGE_KEY, JSON.stringify(value));
}

function clearUserApiConfig() {
  localStorage.removeItem(USER_API_STORAGE_KEY);
}

function getCurrentFormConfig() {
  return {
    enabled: document.getElementById("userApiEnabled").checked,
    baseUrl: document.getElementById("userApiBaseUrl").value.trim(),
    model: document.getElementById("userApiModel").value.trim(),
    apiKey: document.getElementById("userApiKey").value.trim(),
    systemPrompt: document.getElementById("userApiSystemPrompt").value.trim()
  };
}

function hasCompleteUserApiConfig(config = null) {
  return Boolean(config?.enabled && config.baseUrl && config.model && config.apiKey);
}

function truncateReply(text = "") {
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleanText) return "";
  return cleanText.length > 80 ? `${cleanText.slice(0, 80)}...` : cleanText;
}

function renderActiveStatus(config = null) {
  const title = document.getElementById("activeApiTitle");
  const text = document.getElementById("activeApiText");
  const badge = document.getElementById("activeApiBadge");

  if (hasCompleteUserApiConfig(config)) {
    title.textContent = "当前会优先使用你自己的 API。";
    text.textContent = `聊天页会优先走你当前浏览器里保存的 ${config.model} 接口，不会写进站点后台。`;
    badge.textContent = "使用本机 API";
    return;
  }

  if (config?.enabled) {
    title.textContent = "你的本机 API 还没填完整。";
    text.textContent = "你已经打开了自己的 API，但还缺少 Base URL、模型名或 API Key。补全后再保存，聊天页才会真正切过去。";
    badge.textContent = "待补全";
    return;
  }

  if (siteConfig?.privacy?.aiEnabled) {
    title.textContent = "当前会使用站点默认 API。";
    text.textContent = "你没有启用自己的本机 API，所以聊天会走站点默认配置。";
    badge.textContent = "使用站点默认";
    return;
  }

  title.textContent = "当前使用本地规则回复。";
  text.textContent = "想用在线模型，请选一个模型预设，填入你自己的 API Key，再测试并保存。";
  badge.textContent = "使用本地模式";
}

function renderForm(config = null) {
  document.getElementById("userApiEnabled").checked = Boolean(config?.enabled);
  document.getElementById("userApiBaseUrl").value = config?.baseUrl || "";
  document.getElementById("userApiModel").value = config?.model || "";
  document.getElementById("userApiKey").value = config?.apiKey || "";
  document.getElementById("userApiSystemPrompt").value = config?.systemPrompt || "";
  renderActiveStatus(config);
}

function refreshFromStorage() {
  const nextConfig = readUserApiConfig();
  renderForm(nextConfig);
}

async function init() {
  registerServiceWorker();
  const payload = await api("/api/public/bootstrap");
  siteConfig = payload.config;
  bindSiteName(payload.config);
  document.title = `${payload.config.site.name} | 我的 API`;

  renderForm(readUserApiConfig());

  bindAiPresets(document.getElementById("userApiPreset"), {
    baseUrlInput: document.getElementById("userApiBaseUrl"),
    modelInput: document.getElementById("userApiModel"),
    keyInput: document.getElementById("userApiKey"),
    onSelect(preset) {
      document.getElementById("userApiEnabled").checked = true;
      setInlineStatus(userApiStatus, `已填入 ${preset.label}。填好对应的 API Key 后可以测试连接。`, "info");
      renderActiveStatus(getCurrentFormConfig());
    }
  });

  document.getElementById("userApiForm").addEventListener("input", () => {
    renderActiveStatus(getCurrentFormConfig());
  });

  document.getElementById("userApiForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const nextConfig = getCurrentFormConfig();
    writeUserApiConfig(nextConfig);
    renderActiveStatus(nextConfig);
    setInlineStatus(userApiStatus, "你的 API 配置已经保存在当前浏览器里。", "success");
  });

  document.getElementById("testUserApiBtn").addEventListener("click", async () => {
    const nextConfig = getCurrentFormConfig();

    try {
      setInlineStatus(userApiStatus, "正在测试连接...", "info");
      const response = await api("/api/public/test-ai", {
        method: "POST",
        body: {
          userAi: nextConfig
        }
      });
      setInlineStatus(userApiStatus, `连接成功：${truncateReply(response.reply) || "接口已经能正常返回内容。"}`, "success");
    } catch (error) {
      setInlineStatus(userApiStatus, error.message, "error");
    }
  });

  document.getElementById("clearUserApiBtn").addEventListener("click", () => {
    clearUserApiConfig();
    renderForm();
    setInlineStatus(userApiStatus, "当前浏览器里的 API 配置已经清除。", "success");
  });

  window.addEventListener("storage", (event) => {
    if (event.key === USER_API_STORAGE_KEY) {
      refreshFromStorage();
    }
  });

}

init().catch((error) => {
  setInlineStatus(userApiStatus, error.message, "error");
});
