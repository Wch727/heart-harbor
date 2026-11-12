import { api, bindSiteFields, bindSiteName, registerServiceWorker } from "./shared.js";

function applyConfig(config) {
  bindSiteName(config);
  bindSiteFields({
    emergencyHotline: config.site.emergencyHotline,
    emergencySecondary: config.site.emergencySecondary,
    crisisBanner: config.site.crisisBanner
  });

  document.title = `${config.site.name} | 陪伴方式`;
  document.getElementById("footerNote").textContent = config.site.footerNote;
}

async function init() {
  registerServiceWorker();
  const payload = await api("/api/public/bootstrap");
  applyConfig(payload.config);
}

init().catch(() => {});
