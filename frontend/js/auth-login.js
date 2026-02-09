// frontend/js/auth-login.js
(() => {
  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("loginEmail");
  const pwEl = document.getElementById("loginPassword");
  const statusEl = document.getElementById("loginStatus");

  const lockoutScreen = document.getElementById("lockout-screen");
  const lockoutTimer = document.getElementById("lockout-timer");

  function showStatus(msg, isError=false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.remove("hidden");
    statusEl.classList.toggle("text-red-600", !!isError);
    statusEl.classList.toggle("text-slate-600", !isError);
  }

  function startLockoutCountdown(seconds) {
    if (!lockoutScreen || !lockoutTimer) return;
    lockoutScreen.classList.remove("hidden");

    let remaining = Math.max(0, Number(seconds) || 0);
    const tick = () => {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      lockoutTimer.textContent = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
      remaining -= 1;
      if (remaining < 0) {
        clearInterval(interval);
        lockoutScreen.classList.add("hidden");
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
  }

  async function onSubmit(e) {
    e.preventDefault();
    showStatus("Signing in…");

    const email = (emailEl?.value || "").trim();
    const password = pwEl?.value || "";

    if (!email || !password) {
      showStatus("Please enter your email and password.", true);
      return;
    }

    try {
      const data = await window.API.request("/login", {
        method: "POST",
        body: { email, password },
      });

      // Store a tiny “session”
      localStorage.setItem("gd_user", JSON.stringify({
        userId: data.userId,
        role: data.role,
        email: data.email,
        name: data.name,
      }));

      showStatus("Logged in! Redirecting…");
      // For now, send everyone to the home page.
      setTimeout(() => window.location.href = "index.html", 500);
    } catch (err) {
      const payload = err?.data?.detail ?? err?.data ?? null;

      // FastAPI may return {detail: {message, remaining_seconds}} for lockouts
      if (err.status === 403 && payload && typeof payload === "object" && payload.remaining_seconds != null) {
        showStatus(payload.message || "Account locked.", true);
        startLockoutCountdown(payload.remaining_seconds);
        return;
      }

      if (err.status === 401 && payload && typeof payload === "object" && payload.remaining_attempts != null) {
        showStatus(`Invalid credentials. ${payload.remaining_attempts} attempt(s) remaining.`, true);
        return;
      }

      showStatus("Login failed. Check your email/password.", true);
    }
  }

  if (form) form.addEventListener("submit", onSubmit);

  // Optional: if API_BASE not set, hint the user in console
  if (!window.API?.API_BASE) console.warn("API base not set.");
})();
