import { api, bindSiteName, escapeHtml, registerServiceWorker } from "./shared.js";

const state = {
  allResources: [],
  activeFilter: "all"
};

function applyConfig(config) {
  bindSiteName(config);
  document.title = `${config.site.name} | 支持卡`;
  document.getElementById("footerNote").textContent = config.site.footerNote;
}

function getCategories(resources) {
  return [...new Set(resources.map((item) => item.category).filter(Boolean))];
}

function renderFilterButtons() {
  const filterRow = document.getElementById("resourceFilterRow");
  const categories = getCategories(state.allResources);
  const filters = [
    { key: "all", label: "全部" },
    ...categories.map((category) => ({ key: category, label: category }))
  ];

  filterRow.innerHTML = filters
    .map(
      (item) => `
        <button type="button" class="tab-button ${item.key === state.activeFilter ? "active" : ""}" data-filter="${escapeHtml(item.key)}">
          ${escapeHtml(item.label)}
        </button>
      `
    )
    .join("");

  filterRow.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter || "all";
      renderFilterButtons();
      renderResources();
    });
  });
}

function renderResources() {
  const resourceGrid = document.getElementById("resourceGrid");
  const resourceCountNote = document.getElementById("resourceCountNote");
  const visibleResources =
    state.activeFilter === "all"
      ? state.allResources
      : state.allResources.filter((item) => item.category === state.activeFilter);

  resourceCountNote.textContent =
    state.activeFilter === "all"
      ? `共 ${visibleResources.length} 张`
      : `「${state.activeFilter}」有 ${visibleResources.length} 张`;

  resourceGrid.innerHTML = visibleResources.length
    ? visibleResources
        .map(
          (item) => `
            <article class="resource-card resource-card--full">
              <div class="resource-card__head">
                <h3>${escapeHtml(item.title)}</h3>
                <span class="resource-badge">${escapeHtml(item.category)}</span>
              </div>
              <p>${escapeHtml(item.description)}</p>
              <ol class="resource-step-list">
                ${item.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
              </ol>
              <div class="resource-card__actions">
                <a href="/chat?mode=listen" class="button button-secondary">带着它去聊天</a>
                <a href="/checkin" class="button button-secondary">先去签到</a>
              </div>
            </article>
          `
        )
        .join("")
    : `
        <article class="resource-card resource-card--full">
          <div class="resource-card__head">
            <h3>这里还没有卡片</h3>
          </div>
          <p>如果有话想说，也可以去聊几句。</p>
          <div class="resource-card__actions">
            <a href="/chat?mode=listen" class="button button-primary">去聊几句</a>
            ${state.activeFilter === "all" ? "" : '<button type="button" class="button button-secondary" id="resetResourceFilterBtn">看全部卡片</button>'}
          </div>
        </article>
      `;

  const resetFilterBtn = document.getElementById("resetResourceFilterBtn");
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener("click", () => {
      state.activeFilter = "all";
      renderFilterButtons();
      renderResources();
    });
  }
}

async function init() {
  registerServiceWorker();
  const [bootstrap, resourcePayload] = await Promise.all([
    api("/api/public/bootstrap"),
    api("/api/public/resources")
  ]);

  applyConfig(bootstrap.config);
  state.allResources = resourcePayload.resources;
  renderFilterButtons();
  renderResources();
}

init().catch(() => {});
