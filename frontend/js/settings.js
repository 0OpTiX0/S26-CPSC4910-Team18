function safeParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function getStoredUser() {
  return safeParse(localStorage.getItem("gd_user")) || safeParse(sessionStorage.getItem("gd_user"));
}

function setStoredUser(user) {
  if (sessionStorage.getItem("gd_user")) {
    sessionStorage.setItem("gd_user", JSON.stringify(user));
  } else {
    localStorage.setItem("gd_user", JSON.stringify(user));
  }
}

function computeInitials(name) {
  const cleaned = String(name || "").trim();
  if (!cleaned) return "U";
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ? w[0].toUpperCase() : ""))
    .join("") || "U";
}

document.addEventListener("DOMContentLoaded", async () => {
  let user = getStoredUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const viewMode = document.getElementById("view-mode");
  const editMode = document.getElementById("edit-mode");
  const editActions = document.getElementById("edit-actions");
  const editBtn = document.getElementById("edit-toggle-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const form = document.getElementById("settings-form");
  const profileInitials = document.getElementById("profile-initials");
  const deleteBtn = document.getElementById("delete-account-btn");

  const viewName = document.getElementById("view-name");
  const viewEmail = document.getElementById("view-email");
  const viewPhone = document.getElementById("view-phone");
  const viewBio = document.getElementById("view-bio");

  const setName = document.getElementById("set-name");
  const setEmail = document.getElementById("set-email");
  const setPhone = document.getElementById("set-phone");
  const setBio = document.getElementById("set-bio");

  const pwForm = document.getElementById("password-form");
  const currentPw = document.getElementById("current-password");
  const newPw = document.getElementById("new-password");
  const confirmPw = document.getElementById("confirm-password");
  const pwError = document.getElementById("pw-error");
  const pwSuccess = document.getElementById("pw-success");
  const pwClearBtn = document.getElementById("pw-clear-btn");
  const pwSubmitBtn = document.getElementById("pw-submit-btn");

  function getUserId() {
    return user?.userId ?? user?.UserID ?? user?.id ?? null;
  }

  function showInlineMessage(target, message, kind = "info") {
    if (!target) return;
    target.textContent = String(message || "");
    target.classList.remove("hidden", "text-red-600", "text-green-600", "text-slate-600");
    if (kind === "error") target.classList.add("text-red-600");
    else if (kind === "success") target.classList.add("text-green-600");
    else target.classList.add("text-slate-600");
    if (!message) target.classList.add("hidden");
  }

  function normalizeAccountPayload(account, existingUser) {
    return {
      ...existingUser,
      userId: account?.userId ?? existingUser?.userId ?? existingUser?.UserID ?? existingUser?.id,
      id: account?.userId ?? existingUser?.id ?? existingUser?.userId,
      name: account?.name ?? existingUser?.name ?? "",
      email: account?.email ?? existingUser?.email ?? "",
      phone: account?.phone ?? existingUser?.phone ?? "",
      role: account?.role ?? existingUser?.role ?? "",
      timezone: account?.timezone ?? existingUser?.timezone ?? "",
      bio: existingUser?.bio ?? ""
    };
  }

  function renderUserData() {
    user = getStoredUser() || user;

    if (profileInitials) {
      profileInitials.textContent = computeInitials(user?.name);
    }

    if (viewName) viewName.textContent = user?.name || "—";
    if (viewEmail) viewEmail.textContent = user?.email || "—";
    if (viewPhone) viewPhone.textContent = user?.phone || "—";
    if (viewBio) viewBio.textContent = user?.bio?.trim() || "No bio provided.";

    if (setName) setName.value = user?.name || "";
    if (setEmail) setEmail.value = user?.email || "";
    if (setPhone) setPhone.value = user?.phone || "";
    if (setBio) setBio.value = user?.bio || "";
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

  async function refreshUserFromBackend() {
    const userId = getUserId();
    if (!userId || !window.API?.request) return;

    const account = await window.API.request(`/account/${encodeURIComponent(userId)}`);
    user = normalizeAccountPayload(account, user);
    setStoredUser(user);
    renderUserData();
  }

  function getErrorMessage(err, fallback = "Something went wrong.") {
    const detail = err?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item?.msg || JSON.stringify(item)).join(", ");
    }
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err?.message || fallback;
  }

  function showToast(message, kind = "success") {
    const toast = document.createElement("div");
    toast.className = `fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white ${
      kind === "error" ? "bg-red-600" : "bg-emerald-600"
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("opacity-0", "transition", "duration-500");
      setTimeout(() => toast.remove(), 500);
    }, 2200);
  }

  function isStrongEnough(pw) {
    return String(pw || "").length >= 8;
  }

  renderUserData();

  try {
    await refreshUserFromBackend();
  } catch (e) {
    console.warn("Could not refresh account from backend:", e);
  }

  editBtn?.addEventListener("click", async () => {
    try {
      await refreshUserFromBackend();
    } catch (e) {
      console.warn("Could not refresh before edit:", e);
    }
    enterEditMode();
  });

  cancelBtn?.addEventListener("click", async () => {
    try {
      await refreshUserFromBackend();
    } catch (e) {
      renderUserData();
    }
    exitEditMode();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || "Save Changes";
    const userId = getUserId();

    if (!userId) {
      showToast("Missing user ID. Log in again.", "error");
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
      }

      const payload = {
        name: setName?.value.trim() || "",
        phone: setPhone?.value.trim() || "",
        timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      };

      await window.API.request(`/account/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: payload
      });

      user = {
        ...user,
        name: payload.name,
        phone: payload.phone,
        bio: setBio?.value || user?.bio || ""
      };
      setStoredUser(user);

      await refreshUserFromBackend();

      user.bio = setBio?.value || "";
      setStoredUser(user);
      renderUserData();

      exitEditMode();
      showToast("Profile updated successfully.");
    } catch (err) {
      console.error(err);
      showToast(getErrorMessage(err, "Could not update profile."), "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  deleteBtn?.addEventListener("click", () => {
    const confirmed = confirm("Are you sure you want to delete your account? This only clears your session on this device.");
    if (!confirmed) return;

    localStorage.removeItem("gd_user");
    sessionStorage.removeItem("gd_user");
    alert("Your local session was cleared.");
    window.location.href = "index.html";
  });

  function clearPasswordForm() {
    if (currentPw) currentPw.value = "";
    if (newPw) newPw.value = "";
    if (confirmPw) confirmPw.value = "";
    pwError?.classList.add("hidden");
    pwSuccess?.classList.add("hidden");
  }

  function showPwError(msg) {
    if (pwSuccess) pwSuccess.classList.add("hidden");
    showInlineMessage(pwError, msg, "error");
  }

  function showPwSuccess(msg) {
    if (pwError) pwError.classList.add("hidden");
    showInlineMessage(pwSuccess, msg, "success");
  }

  pwClearBtn?.addEventListener("click", clearPasswordForm);

  pwForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId = getUserId();
    if (!userId) {
      showPwError("Missing user ID. Log out and log in again.");
      return;
    }

    const cur = (currentPw?.value || "").trim();
    const npw = newPw?.value || "";
    const cpw = confirmPw?.value || "";

    if (!cur) return showPwError("Please enter your current password.");
    if (!npw) return showPwError("Please enter a new password.");
    if (npw !== cpw) return showPwError("New password and confirmation do not match.");
    if (!isStrongEnough(npw)) return showPwError("Password must be at least 8 characters.");

    try {
      if (pwSubmitBtn) {
        pwSubmitBtn.disabled = true;
        pwSubmitBtn.textContent = "Changing...";
      }

      await window.API.request(`/account/${encodeURIComponent(userId)}/change-password`, {
        method: "POST",
        body: {
          current_password: cur,
          new_password: npw
        }
      });

      showPwSuccess("Password changed successfully.");
      clearPasswordForm();
    } catch (err) {
      console.error(err);
      showPwError(
        err?.data?.detail?.[0]?.msg ||
        err?.data?.detail ||
        err?.data?.message ||
        err?.message ||
        "Could not change password."
      );
    } finally {
      if (pwSubmitBtn) {
        pwSubmitBtn.disabled = false;
        pwSubmitBtn.textContent = "Change Password";
      }
    }
  });
});