import { api, bindSiteName, escapeHtml, registerServiceWorker } from "./shared.js";

function buildLine(points, width, height, key) {
  const usableWidth = width - 24;
  const usableHeight = height - 24;
  const step = points.length > 1 ? usableWidth / (points.length - 1) : usableWidth;

  return points
    .map((item, index) => {
      const value = Number(item[key] || 0);
      const x = 12 + index * step;
      const y = 12 + usableHeight - (value / 10) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");
}

function renderTrendChart(containerId, items) {
  const container = document.getElementById(containerId);
  const hasData = items.some((item) => Number(item.avgEnergy) > 0 || Number(item.avgStress) > 0);
  if (!hasData) {
    container.innerHTML = `<p class="section-copy">还没有足够的记录，等你连续签到几次后，这里会出现趋势图。</p>`;
    return;
  }

  const width = 760;
  const height = 220;
  const energyLine = buildLine(items, width, height, "avgEnergy");
  const stressLine = buildLine(items, width, height, "avgStress");
  const labels = items
    .map((item, index) => {
      const x = 12 + (items.length > 1 ? (width - 24) / (items.length - 1) : 0) * index;
      return `<text x="${x}" y="${height - 4}" text-anchor="middle">${escapeHtml(item.label)}</text>`;
    })
    .join("");

  container.innerHTML = `
    <div class="trend-chart-legend">
      <span><i class="legend-dot legend-dot--energy"></i>精力</span>
      <span><i class="legend-dot legend-dot--stress"></i>压力</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="精力与压力趋势图">
      <line x1="12" y1="12" x2="12" y2="${height - 24}" class="trend-axis"></line>
      <line x1="12" y1="${height - 24}" x2="${width - 12}" y2="${height - 24}" class="trend-axis"></line>
      <polyline points="${energyLine}" class="trend-line trend-line--energy"></polyline>
      <polyline points="${stressLine}" class="trend-line trend-line--stress"></polyline>
      ${labels}
    </svg>
  `;
}

function renderSeries(containerId, items) {
  const container = document.getElementById(containerId);
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  container.innerHTML = items
    .map(
      (item) => `
        <article class="weather-point-card">
          <div class="weather-point-card__head">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${item.count ? `${item.count} 次` : "无记录"}</span>
          </div>
          <div class="weather-bar-track">
            <div class="weather-bar-fill" style="width:${(item.count / maxCount) * 100}%; background:${item.dominantMoodColor};"></div>
          </div>
          <div class="weather-point-card__meta">
            <span>主情绪：${escapeHtml(item.dominantMood)}</span>
            <span>精力 ${item.avgEnergy || 0} / 压力 ${item.avgStress || 0}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSuggestions(items) {
  const container = document.getElementById("insightSuggestions");
  container.innerHTML = items.length
    ? items.map((item) => `<div><strong>可以留意</strong><p>${escapeHtml(item)}</p></div>`).join("")
    : `<div><strong>还在生成</strong><p>等你多留下一些记录，这里会更像属于你自己的节奏图。</p></div>`;
}

function renderMoodBreakdown(items) {
  const container = document.getElementById("moodBreakdown");
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  container.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <div class="weather-breakdown-row">
              <strong>${escapeHtml(item.mood)}</strong>
              <div class="weather-bar-track">
                <div class="weather-bar-fill" style="width:${(item.count / maxCount) * 100}%"></div>
              </div>
              <span>${item.count} 次</span>
            </div>
          `
        )
        .join("")
    : `<p class="section-copy">还没有足够的签到记录。</p>`;
}

function applyConfig(config) {
  bindSiteName(config);
  document.title = `${config.site.name} | 情绪晴雨表`;
  document.getElementById("footerNote").textContent = config.site.footerNote;
}

function renderInsights(insights) {
  document.getElementById("weekCount").textContent = insights.weekCount;
  document.getElementById("monthCount").textContent = insights.monthCount;
  document.getElementById("latestMood").textContent = insights.latestMood;
  document.getElementById("weekAverageText").textContent = `${insights.weekAverage.energy || 0} / ${insights.weekAverage.stress || 0}`;
  const weekStressDiff = (insights.weekAverage.stress || 0) - (insights.monthAverage.stress || 0);
  const weekEnergyDiff = (insights.weekAverage.energy || 0) - (insights.monthAverage.energy || 0);
  const compareText = `精力 ${weekEnergyDiff >= 0 ? "+" : ""}${weekEnergyDiff.toFixed(1)} / 压力 ${weekStressDiff >= 0 ? "+" : ""}${weekStressDiff.toFixed(1)}`;
  document.getElementById("weekCompareText").textContent = compareText;
  document.getElementById("activeDaysText").textContent = `${(insights.weekSeries || []).filter((item) => item.count > 0).length} / 7`;
  document.getElementById("insightTitle").textContent = insights.insight.title;
  document.getElementById("insightSummary").textContent = insights.insight.summary;
  document.getElementById("latestNote").textContent = insights.latestNote || "最近一次签到没有留下补充内容。";

  renderSuggestions(insights.insight.suggestions || []);
  renderTrendChart("weekTrendChart", insights.weekSeries || []);
  renderTrendChart("monthTrendChart", insights.monthSeries || []);
  renderSeries("weekSeries", insights.weekSeries || []);
  renderSeries("monthSeries", insights.monthSeries || []);
  renderMoodBreakdown(insights.moodBreakdown || []);
}

async function init() {
  registerServiceWorker();
  const [bootstrap, payload] = await Promise.all([
    api("/api/public/bootstrap"),
    api("/api/public/checkin-insights")
  ]);

  applyConfig(bootstrap.config);
  renderInsights(payload.insights);
}

init().catch(() => {});
