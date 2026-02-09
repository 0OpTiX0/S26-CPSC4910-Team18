// frontend/js/auth-forgot.js
(() => {
  const form = document.getElementById("forgotForm");
  if (!form) return;

  const email = document.getElementById("email");
  const emailError = document.getElementById("emailError");
  const btn = document.getElementById("sendBtn");
  const btnText = document.getElementById("sendBtnText");
  const successBox = document.getElementById("successBox");
  const status = document.getElementById("status");

  function setEmailError(msg) {
    emailError.textContent = msg || "";
    emailError.classList.toggle("hidden", !msg);
  }

  function validateEmail() {
    const v = (email?.value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setEmailError("Enter a valid email.");
      return false;
    }
    setEmailError("");
    return true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateEmail()) return;

    btn.disabled = true;
    btn.classList.add("opacity-80", "cursor-not-allowed");
    btnText.textContent = "Sending…";
    status.textContent = "";

    try {
      const res = await window.API.request("/password/request-reset", {
        method: "POST",
        body: { email: email.value.trim() },
      });

      // Demo: backend may return a token (if email exists). Show it so the UI is fully testable.
      successBox.classList.remove("hidden");
      if (res?.token) {
        successBox.querySelector("#demoToken")?.remove();
        const p = document.createElement("p");
        p.id = "demoToken";
        p.className = "text-xs text-slate-500 mt-2 break-all";
        p.textContent = `Demo token: ${res.token}`;
        successBox.appendChild(p);

        const link = document.createElement("a");
        link.className = "text-sm font-semibold text-blue-600 hover:text-blue-700 mt-3 inline-block";
        link.href = `password_update.html?token=${encodeURIComponent(res.token)}`;
        link.textContent = "Continue to reset password →";
        successBox.appendChild(link);
      }
    } catch (err) {
      // Still show success to avoid account enumeration
      successBox.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.classList.remove("opacity-80", "cursor-not-allowed");
      btnText.textContent = "Send reset link";
    }
  });

  email?.addEventListener("blur", validateEmail);
})();
