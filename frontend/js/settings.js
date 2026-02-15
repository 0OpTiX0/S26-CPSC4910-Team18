// frontend/js/settings.js

function safeParse(s) {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

function getStoredUser() {
  return safeParse(localStorage.getItem("gd_user")) || safeParse(sessionStorage.getItem("gd_user"));
}

function setStoredUser(user) {
  if (sessionStorage.getItem("gd_user")) sessionStorage.setItem("gd_user", JSON.stringify(user));
  else localStorage.setItem("gd_user", JSON.stringify(user));
}

document.addEventListener("DOMContentLoaded", async () => {
  let user = getStoredUser();
  if (!user) { window.location.href = "login.html"; return; }

  // Profile elements
  const editActions = document.getElementById("edit-actions");
  const editBtn = document.getElementById("edit-toggle-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const viewMode = document.getElementById("view-mode");
  const editMode = document.getElementById("edit-mode");
  const form = document.getElementById("settings-form");
  const profileInitials = document.getElementById("profile-initials");
  const deleteBtn = document.getElementById("delete-account-btn");

  // View fields
  const viewName = document.getElementById("view-name");
  const viewEmail = document.getElementById("view-email");
  const viewBio = document.getElementById("view-bio");
  const viewPhone = document.getElementById("view-phone");

  // Edit fields
  const setName = document.getElementById("set-name");
  const setEmail = document.getElementById("set-email");
  const setBio = document.getElementById("set-bio");
  const setPhone = document.getElementById("set-phone");

  function computeInitials(name) {
    const cleaned = (name || "").trim();
    if (!cleaned) return "U";
    return cleaned.split(/\s+/).slice(0, 2).map(w => (w[0] ? w[0].toUpperCase() : "")).join("") || "U";
  }

  function loadUserData() {
    user = getStoredUser() || user;

    if (profileInitials) profileInitials.textContent = computeInitials(user.name);
    if (viewName) viewName.textContent = user.name || "—";
    if (viewEmail) viewEmail.textContent = user.email || "—";
    if (viewBio) viewBio.textContent = user.bio || "No bio provided.";
    if (viewPhone) viewPhone.textContent = user.phone || "—";

    if (setName) setName.value = user.name || "";
    if (setEmail) setEmail.value = user.email || "";
    if (setBio) setBio.value = user.bio || "";
    if (setPhone) setPhone.value = user.phone || "";
  }

  function enterEditMode() {
    viewMode?.classList.add("hidden");
    editMode?.classList.remove("hidden");
    editBtn?.classList.add("hidden");
    editActions?.classList.remove("hidden");
  }

  function exitEditMode() {
    viewMode?.classList.remove("hidden");
    editMode?.classList.add("hidden");
    editBtn?.classList.remove("hidden");
    editActions?.classList.add("hidden");
  }

  async function hydratePhoneIfMissing() {
    try {
      if (!user.email || user.phone) return;
      if (!window.API?.request) return;

      const results = await window.API.request(`/user?userEmail=${encodeURIComponent(user.email)}`);
      const row = Array.isArray(results) ? results[0] : results;
      if (!row) return;

      const phone =
        row.User_Phone_Num || row.user_phone_num || row.userPhoneNum || row.phone || row.phoneNumber;

      if (phone) {
        user.phone = String(phone);
        setStoredUser(user);
      }
    } catch (e) {
      console.warn("Could not hydrate phone:", e);
    }
  }

  // Initial render
  loadUserData();
  await hydratePhoneIfMissing();
  loadUserData();

  // Profile events
  editBtn?.addEventListener("click", () => { loadUserData(); enterEditMode(); });
  cancelBtn?.addEventListener("click", () => { exitEditMode(); loadUserData(); });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || "Save Changes";

    if (submitBtn) {
        submitBtn.textContent = "Saving...";
        submitBtn.disabled = true;
    }

    user = getStoredUser() || user;
    const userId = user?.userId ?? user?.UserID ?? user?.id;

    try {
        // Send update to DB
        await window.API.request(`/account/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: {
            name: setName.value.trim(),
            phone: setPhone.value.trim()
        }
        });

        // Update local session AFTER DB succeeds
        user.name = setName.value.trim();
        user.phone = setPhone.value.trim();
        user.bio = setBio.value;

        setStoredUser(user);

        loadUserData();
        exitEditMode();

        alert("Profile updated successfully!");
    } catch (err) {
        const msg =
        err?.data?.detail ||
        err?.message ||
        "Could not update profile.";
        alert(msg);
    } finally {
        if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        }
    }
    });


  deleteBtn?.addEventListener("click", () => {
    const confirmed = confirm("Are you sure you want to delete your account? This will remove your local session on this device.");
    if (!confirmed) return;
    localStorage.removeItem("gd_user");
    sessionStorage.removeItem("gd_user");
    alert("Your local session was cleared.");
    window.location.href = "index.html";
  });

  // -------------------------
  // Password Change (Backend)
  // -------------------------
  const pwForm = document.getElementById("password-form");
  const currentPw = document.getElementById("current-password");
  const newPw = document.getElementById("new-password");
  const confirmPw = document.getElementById("confirm-password");
  const pwError = document.getElementById("pw-error");
  const pwSuccess = document.getElementById("pw-success");
  const pwClearBtn = document.getElementById("pw-clear-btn");
  const pwSubmitBtn = document.getElementById("pw-submit-btn");

  function showPwError(msg) {
    pwSuccess?.classList.add("hidden");
    if (!pwError) return;
    pwError.textContent = String(msg);
    pwError.classList.remove("hidden");
  }

  function showPwSuccess(msg) {
    pwError?.classList.add("hidden");
    if (!pwSuccess) return;
    pwSuccess.textContent = String(msg);
    pwSuccess.classList.remove("hidden");
  }

  function isStrongEnough(pw) {
    return pw.length >= 8;
  }

  pwClearBtn?.addEventListener("click", () => {
    if (currentPw) currentPw.value = "";
    if (newPw) newPw.value = "";
    if (confirmPw) confirmPw.value = "";
    pwError?.classList.add("hidden");
    pwSuccess?.classList.add("hidden");
  });

  pwForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!window.API?.request) {
      showPwError("API not available. Make sure api.js loads before settings.js.");
      return;
    }

    user = getStoredUser() || user;
    const userId = user?.userId ?? user?.UserID ?? user?.id;
    if (!userId) { showPwError("Missing userId. Log out and log in again."); return; }

    const cur = (currentPw?.value || "").trim();
    const npw = newPw?.value || "";
    const cpw = confirmPw?.value || "";

    if (!cur) return showPwError("Please enter your current password.");
    if (!npw) return showPwError("Please enter a new password.");
    if (npw !== cpw) return showPwError("New password and confirmation do not match.");
    if (!isStrongEnough(npw)) return showPwError("Password must be 8+ chars.");

    try {
      if (pwSubmitBtn) { pwSubmitBtn.disabled = true; pwSubmitBtn.textContent = "Changing..."; }

      await window.API.request(`/account/${encodeURIComponent(userId)}/change-password`, {
        method: "POST",
        body: { current_password: cur, new_password: npw }
      });

      showPwSuccess("Password changed successfully.");
      if (currentPw) currentPw.value = "";
      if (newPw) newPw.value = "";
      if (confirmPw) confirmPw.value = "";
    } catch (err) {
      const d = err?.data;
      const msg =
        d?.detail?.[0]?.msg ||
        d?.detail ||
        d?.message ||
        err?.message ||
        "Could not change password. Check your current password and try again.";
      showPwError(msg);
    } finally {
      if (pwSubmitBtn) { pwSubmitBtn.disabled = false; pwSubmitBtn.textContent = "Change Password"; }
    }
  });
});
