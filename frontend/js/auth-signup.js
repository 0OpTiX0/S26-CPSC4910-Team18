// frontend/js/auth-signup.js
(() => {
  const form = document.getElementById("signupForm");
  if (!form) return;

  const fullName = document.getElementById("fullName");
  const phone = document.getElementById("phone");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const confirmPassword = document.getElementById("confirmPassword");
  const role = document.getElementById("role");

  const nameError = document.getElementById("nameError");
  const phoneError = document.getElementById("phoneError");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const confirmError = document.getElementById("confirmError");

  const btn = document.getElementById("signupBtn");
  const btnText = document.getElementById("signupBtnText");
  const status = document.getElementById("signupStatus");

  const normalizePhone = (v) => (v || "").replace(/[^\d]/g, "");

  function setFieldError(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  function setStatus(msg, isError=false) {
    if (!status) return;
    status.textContent = msg;
    status.classList.remove("hidden");
    status.classList.toggle("text-red-600", !!isError);
    status.classList.toggle("text-slate-600", !isError);
  }

  function validate() {
    let ok = true;

    const n = (fullName?.value || "").trim();
    if (n.length < 2) { setFieldError(nameError, "Please enter your full name."); ok = false; }
    else setFieldError(nameError, "");

    const p = normalizePhone(phone?.value || "");
    // backend expects a string; keep it digits-only for consistent uniqueness.
    if (p.length < 10) { setFieldError(phoneError, "Enter a valid phone number."); ok = false; }
    else setFieldError(phoneError, "");

    const e = (email?.value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setFieldError(emailError, "Enter a valid email."); ok = false; }
    else setFieldError(emailError, "");

    const pw = password?.value || "";
    if (pw.length < 8) { setFieldError(passwordError, "Password must be at least 8 characters."); ok = false; }
    else setFieldError(passwordError, "");

    if ((confirmPassword?.value || "") !== pw) { setFieldError(confirmError, "Passwords do not match."); ok = false; }
    else setFieldError(confirmError, "");

    return ok;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    btn.disabled = true;
    btn.classList.add("opacity-80", "cursor-not-allowed");
    btnText.textContent = "Creating…";
    setStatus("Creating your account…");

    try {
      await window.API.request("/user", {
        method: "POST",
        body: {
          name: fullName.value.trim(),
          role: role.value,
          email: email.value.trim(),
          phone: normalizePhone(phone.value),
          pssw: password.value,
        },
      });

      setStatus("Account created! Redirecting to login…");
      setTimeout(() => window.location.href = "login.html", 600);
    } catch (err) {
      const detail = err?.data?.detail;

      if (err.status === 409 && typeof detail === "string") {
        setStatus(detail, true);
      } else if (err.status === 422) {
        setStatus("Missing/invalid fields. Please check the form.", true);
      } else {
        setStatus("Sign up failed. Please try again.", true);
      }
    } finally {
      btn.disabled = false;
      btn.classList.remove("opacity-80", "cursor-not-allowed");
      btnText.textContent = "Create Account";
    }
  });

  fullName?.addEventListener("blur", validate);
  phone?.addEventListener("blur", validate);
  email?.addEventListener("blur", validate);
  password?.addEventListener("blur", validate);
  confirmPassword?.addEventListener("blur", validate);
})();
