export async function api(path, options = {}) {
  const requestOptions = { ...options };

  if (requestOptions.body && typeof requestOptions.body === "object" && !(requestOptions.body instanceof FormData)) {
    requestOptions.headers = {
      "Content-Type": "application/json",
      ...(requestOptions.headers || {})
    };
    requestOptions.body = JSON.stringify(requestOptions.body);
  }

  const response = await fetch(path, requestOptions);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string" ? payload : payload?.error || "请求失败";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDate(value) {
  if (!value) return "暂无";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return value;
  }
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

export function setInlineStatus(element, message, tone = "info") {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
}

export function bindSiteName(config) {
  document.querySelectorAll("[data-bind='site-name']").forEach((node) => {
    node.textContent = config.site.name;
  });
  document.querySelectorAll("[data-bind='site-tagline']").forEach((node) => {
    node.textContent = config.site.tagline;
  });
}

export function bindSiteFields(fields = {}) {
  Object.entries(fields).forEach(([key, value]) => {
    document.querySelectorAll(`[data-site-text='${key}']`).forEach((node) => {
      node.textContent = value;
    });
  });
}
