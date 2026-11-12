import { api, bindSiteFields, bindSiteName, registerServiceWorker, setInlineStatus } from "./shared.js";

const checkinForm = document.getElementById("checkinForm");
const checkinStatus = document.getElementById("checkinStatus");
const energyRange = document.getElementById("energyRange");
const stressRange = document.getElementById("stressRange");
const energyValue = document.getElementById("energyValue");
const stressValue = document.getElementById("stressValue");

function updateRangeOutputs() {
  energyValue.textContent = energyRange.value;
  stressValue.textContent = stressRange.value;
}

function applyConfig(config) {
  bindSiteName(config);
  bindSiteFields({
    emergencyHotline: config.site.emergencyHotline,
    emergencySecondary: config.site.emergencySecondary,
    crisisBanner: config.site.crisisBanner
  });

  document.title = `${config.site.name} | 情绪签到`;
  document.getElementById("footerNote").textContent = config.site.footerNote;
}

async function loadBootstrap() {
  const payload = await api("/api/public/bootstrap");
  applyConfig(payload.config);
}

async function handleCheckinSubmit(event) {
  event.preventDefault();
  const formData = new FormData(checkinForm);

  try {
    setInlineStatus(checkinStatus, "正在保存…", "info");
    const payload = await api("/api/public/checkin", {
      method: "POST",
      body: {
        nickname: formData.get("nickname"),
        mood: formData.get("mood"),
        energy: Number(formData.get("energy")),
        stress: Number(formData.get("stress")),
        note: formData.get("note")
      }
    });

    setInlineStatus(checkinStatus, payload.message, "success");
    checkinForm.reset();
    document.querySelectorAll("input[name='mood']").forEach((input) => {
      input.checked = false;
    });
    energyRange.value = "5";
    stressRange.value = "5";
    updateRangeOutputs();
  } catch (error) {
    setInlineStatus(checkinStatus, error.message, "error");
  }
}

async function init() {
  registerServiceWorker();
  updateRangeOutputs();
  energyRange.addEventListener("input", updateRangeOutputs);
  stressRange.addEventListener("input", updateRangeOutputs);
  checkinForm.addEventListener("submit", handleCheckinSubmit);
  await loadBootstrap();
}

init().catch(() => {});
