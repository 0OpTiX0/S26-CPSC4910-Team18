// frontend/js/auth-password-update.js
(() => {
  const form = document.getElementById("passwordUpdateForm");
  if (!form) return;

  const currentPw = document.getElementById("currentPassword");
  const newPw = document.getElementById("newPassword");
  const confirmPw = document.getElementById("confirmNewPassword");
  const status = document.getElementById("pwStatus");

  const token = new URLSearchParams(window.location.search).get("token");

  function setStatus(msg, isError=false) {
    status.textContent = msg;
    status.classList.remove("hidden");
    status.classList.toggle("text-red-600", !!isError);
    status.classList.toggle("text-slate-600", !isError);
  }

  function getLoggedInEmail() {
    try {
      const u = JSON.parse(localStorage.getItem("gd_user") || "null");
      return u?.email || "";
    } catch { return ""; }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const np = newPw.value || "";
    if (np.length < 8) return setStatus("New password must be at least 8 characters.", true);
    if ((confirmPw.value || "") !== np) return setStatus("New passwords do not match.", true);

    setStatus("Updating password…");

    try {
      if (token) {
        await window.API.request("/password/reset", {
          method: "POST",
          body: { token, new_password: np },
        });
      } else {
        const email = getLoggedInEmail();
        if (!email) return setStatus("You must be logged in (or use a reset link) to change your password.", true);

        await window.API.request("/password/change", {
          method: "POST",
          body: { email, current_password: currentPw.value || "", new_password: np },
        });
      }

      setStatus("Password updated! Redirecting to login…");
      localStorage.removeItem("gd_user");
      setTimeout(() => window.location.href = "login.html", 800);
    } catch (err) {
      setStatus("Password update failed. Please try again.", true);
    }
  });

  // If reset flow (token), hide current password input
  if (token) {
    const currentWrap = document.getElementById("currentPasswordWrap");
    if (currentWrap) currentWrap.classList.add("hidden");
  }
})();
