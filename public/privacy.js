import { api, bindSiteFields, bindSiteName, registerServiceWorker, setInlineStatus } from "./shared.js";

const STORAGE_KEY = "companion-active-conversation";
const SUPPORT_MODE_KEY = "companion-support-mode";
const clearPrivacyStatus = document.getElementById("clearPrivacyStatus");

function applyConfig(config) {
  bindSiteName(config);
  bindSiteFields({
    emergencyHotline: config.site.emergencyHotline,
    emergencySecondary: config.site.emergencySecondary,
    crisisBanner: config.site.crisisBanner
  });

  document.title = `${config.site.name} | 隐私说明`;
  document.getElementById("footerNote").textContent = config.site.footerNote;
  document.getElementById("privacyAiNote").textContent = config.privacy?.aiEnabled
    ? "当前站点已经启用在线 AI。你的内容会发送到管理员配置的模型接口，但不会在前台公开展示。"
    : "站点默认使用本地规则回复。启用「我的 API」后，聊天也会发送给你选择的模型服务。聊天记录保存在站点的私有目录里。";
}

function clearLocalTrace() {
  if (!window.confirm("清除这个浏览器的会话入口和访客标识？站点保存的聊天和签到会保留。")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SUPPORT_MODE_KEY);
  document.cookie = "companion_visitor_id=; Max-Age=0; Path=/; SameSite=Lax";
  setInlineStatus(clearPrivacyStatus, "已清除浏览器记录。站点保存的聊天和签到仍会保留。", "success");
}

async function init() {
  registerServiceWorker();
  document.getElementById("clearPrivacyTraceBtn").addEventListener("click", clearLocalTrace);

  const payload = await api("/api/public/bootstrap");
  applyConfig(payload.config);
}

init().catch(() => {});
