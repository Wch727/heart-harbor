import { api, bindSiteFields, bindSiteName, escapeHtml, registerServiceWorker, setInlineStatus } from "./shared.js";

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

function renderStats(stats) {
  const checkinCount = document.getElementById("checkinCount");
  const conversationCount = document.getElementById("conversationCount");
  if (checkinCount) checkinCount.textContent = stats.checkinCount;
  if (conversationCount) conversationCount.textContent = stats.conversationCount;

  const moodSnapshot = document.getElementById("moodSnapshot");
  if (!moodSnapshot) return;
  moodSnapshot.innerHTML = stats.moodSnapshot.length
    ? stats.moodSnapshot
        .map(
          (item) =>
            `<span class="chip" style="color:${item.color}">${escapeHtml(item.mood)} ${item.count} 次</span>`
        )
        .join("")
    : `<span class="chip">还没有新的签到情绪</span>`;
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
  renderStats(payload.stats);
}

async function handleCheckinSubmit(event) {
  event.preventDefault();
  const formData = new FormData(checkinForm);

  try {
    setInlineStatus(checkinStatus, "我先帮你轻轻记一下。", "info");
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
    await loadBootstrap();
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
