import { api, bindSiteFields, bindSiteName, registerServiceWorker } from "./shared.js";

function applyConfig(config) {
  bindSiteName(config);
  bindSiteFields({
    emergencyHotline: config.site.emergencyHotline,
    emergencySecondary: config.site.emergencySecondary,
    crisisBanner: config.site.crisisBanner
  });

  document.title = `${config.site.name}｜在这儿坐一会儿吧`;

  const heroTitle = document.getElementById("heroTitle");
  const heroText = document.getElementById("heroText");
  const footerNote = document.getElementById("footerNote");
  const homePrivacyNote = document.getElementById("homePrivacyNote");

  if (heroTitle) heroTitle.textContent = config.site.heroTitle;
  if (heroText) heroText.textContent = config.site.heroText;
  if (footerNote) footerNote.textContent = config.site.footerNote;

  if (homePrivacyNote) {
    homePrivacyNote.textContent = config.privacy?.aiEnabled
      ? "你写下的内容不会公开展示。聊天可能由在线 AI 处理，聊天页会标明。"
      : "你写下的内容会保存在站点的私有目录里，其他访客看不到。";
  }
}

function bindRipplePond() {
  const pond = document.getElementById("ripplePond");
  pond.addEventListener("click", (event) => {
    const bounds = pond.getBoundingClientRect();
    const x = event.detail ? event.clientX - bounds.left - pond.clientLeft : pond.clientWidth / 2;
    const y = event.detail ? event.clientY - bounds.top - pond.clientTop : pond.clientHeight / 2;
    const ripple = document.createElement("span");
    ripple.className = "home-ripples__ring";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    pond.append(ripple);
  });
  pond.hidden = false;
}

async function init() {
  bindRipplePond();
  registerServiceWorker();

  const payload = await api("/api/public/bootstrap");
  applyConfig(payload.config);
}

init().catch(() => {});
