// frontend/js/devices-api.js
(() => {
  const banner = document.getElementById("security-banner");
  const userLabel = document.getElementById("current-user-label");

  const showBanner = (msg, ok=true) => {
    if (!banner) return;
    banner.textContent = msg;
    banner.classList.remove("hidden");
    banner.classList.toggle("bg-emerald-50", ok);
    banner.classList.toggle("border-emerald-200", ok);
    banner.classList.toggle("text-emerald-700", ok);

    banner.classList.toggle("bg-red-50", !ok);
    banner.classList.toggle("border-red-200", !ok);
    banner.classList.toggle("text-red-700", !ok);
  };

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem("gd_user") || "null"); } catch { return null; }
  };

  (async () => {
    const u = getUser();
    if (userLabel) userLabel.textContent = u?.email ? `Signed in as ${u.email}` : "Not signed in";

    try {
      await window.API.request("/health");
      showBanner("Backend connected ✅", true);
    } catch (e) {
      showBanner("Backend not reachable. Check API_BASE and that FastAPI is running.", false);
    }
  })();

  const logoutBtn = document.getElementById("logout-this");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("gd_user");
      window.location.href = "login.html";
    });
  }
})();
