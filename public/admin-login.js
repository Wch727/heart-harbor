import { api, registerServiceWorker, setInlineStatus } from "./shared.js";

const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");

async function checkSession() {
  try {
    const payload = await api("/api/admin/session");
    if (payload.authenticated) {
      window.location.replace("/admin");
    }
  } catch {
    // Ignore session probe failures on login page.
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    setInlineStatus(loginStatus, "正在核对管理员身份...", "info");
    await api("/api/admin/login", {
      method: "POST",
      body: {
        username: formData.get("username"),
        password: formData.get("password")
      }
    });
    setInlineStatus(loginStatus, "验证通过，正在进入后台。", "success");
    window.location.replace("/admin");
  } catch (error) {
    setInlineStatus(loginStatus, error.message, "error");
  }
});

registerServiceWorker();
checkSession();
