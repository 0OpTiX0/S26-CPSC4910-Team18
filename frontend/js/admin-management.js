// frontend/js/admin-management.js
(function () {
  function safeParse(s) {
    try {
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  function getStoredUser() {
    return (
      safeParse(sessionStorage.getItem("gd_user")) ||
      safeParse(localStorage.getItem("gd_user"))
    );
  }

  function showMsg(el, msg, ok = true) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden", "text-emerald-600", "text-rose-600");
    el.classList.add(ok ? "text-emerald-600" : "text-rose-600");
  }

  function normalizeRole(role) {
    const r = String(role || "").trim().toLowerCase();
    if (!r) return "";
    if (r === "sponsor_user" || r === "sponsor") return "sponsor";
    if (r === "driver_user" || r === "driver") return "driver";
    if (r === "admin_user" || r === "admin") return "admin";
    return r;
  }

  function roleBadgeClass(role) {
    switch (normalizeRole(role)) {
      case "admin":
        return "bg-violet-100 text-violet-700";
      case "sponsor":
        return "bg-blue-100 text-blue-700";
      case "driver":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  function formatRole(role) {
    const r = normalizeRole(role);
    if (!r) return "Unknown";
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  async function apiRequest(path, options = {}) {
    if (!window.API?.request) {
      throw new Error("API helper not loaded.");
    }
    return window.API.request(path, options);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const storedUser = getStoredUser();
    const role = normalizeRole(storedUser?.role);

    if (role !== "admin") {
      alert("Admin access required.");
      window.location.href = "index.html";
      return;
    }

    // ---------- User creation ----------
    const toggleCreate = document.getElementById("toggle-create-user");
    const createPanel = document.getElementById("create-user-panel");
    const createUserForm = document.getElementById("create-user-form");

    const createName = document.getElementById("cu-name");
    const createRole = document.getElementById("cu-role");
    const createEmail = document.getElementById("cu-email");
    const createPhone = document.getElementById("cu-phone");
    const createPassword = document.getElementById("cu-password");
    const createSponsorJoin = document.getElementById("cu-sponsor-join");
    const createSponsorJoinWrap = document.getElementById("cu-sponsor-join-wrap");
    const createMsg = document.getElementById("create-user-msg");
    const createClear = document.getElementById("create-user-clear");
    const createSubmit = document.getElementById("create-user-submit");

    // ---------- Sponsor organization creation ----------
    const toggleSponsorOrg = document.getElementById("toggle-sponsor-org");
    const sponsorOrgPanel = document.getElementById("sponsor-org-panel");
    const sponsorOrgForm = document.getElementById("create-sponsor-org-form");

    const sponsorOrgName = document.getElementById("so-name");
    const sponsorOrgEmail = document.getElementById("so-email");
    const sponsorOrgPhone = document.getElementById("so-phone");
    const sponsorOrgDescription = document.getElementById("so-description");
    const sponsorOrgMsg = document.getElementById("so-msg");
    const sponsorOrgClear = document.getElementById("so-clear");
    const sponsorOrgSubmit = document.getElementById("so-submit");

    // ---------- Filters / table ----------
    const searchInput = document.getElementById("admin-user-search");
    const roleFilter = document.getElementById("admin-role-filter");
    const refreshBtn = document.getElementById("refresh-users");
    const tableBody = document.getElementById("admin-users-body");
    const countPill = document.getElementById("admin-users-count");
    const emptyState = document.getElementById("admin-users-empty");

    let allUsers = [];

    function setSponsorJoinVisibility() {
      const selectedRole = normalizeRole(createRole?.value);
      const show = selectedRole === "driver" || selectedRole === "sponsor";
      createSponsorJoinWrap?.classList.toggle("hidden", !show);
    }

    function clearCreateUserForm() {
      if (createName) createName.value = "";
      if (createRole) createRole.value = "driver";
      if (createEmail) createEmail.value = "";
      if (createPhone) createPhone.value = "";
      if (createPassword) createPassword.value = "";
      if (createSponsorJoin) createSponsorJoin.value = "";
      createMsg?.classList.add("hidden");
      setSponsorJoinVisibility();
    }

    function clearSponsorOrgForm() {
      if (sponsorOrgName) sponsorOrgName.value = "";
      if (sponsorOrgEmail) sponsorOrgEmail.value = "";
      if (sponsorOrgPhone) sponsorOrgPhone.value = "";
      if (sponsorOrgDescription) sponsorOrgDescription.value = "";
      sponsorOrgMsg?.classList.add("hidden");
    }

    function getFilteredUsers() {
      const q = String(searchInput?.value || "").trim().toLowerCase();
      const roleVal = normalizeRole(roleFilter?.value);

      return allUsers.filter((u) => {
        const uRole = normalizeRole(u.role || u.User_Role);
        const name = String(u.name || u.User_Name || "").toLowerCase();
        const email = String(u.email || u.User_Email || "").toLowerCase();
        const phone = String(u.phone || u.User_PhoneNum || "").toLowerCase();

        const matchesRole = !roleVal || uRole === roleVal;
        const matchesSearch =
          !q ||
          name.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          uRole.includes(q);

        return matchesRole && matchesSearch;
      });
    }

    function renderUsers() {
      if (!tableBody) return;

      const filtered = getFilteredUsers();
      tableBody.innerHTML = "";

      if (countPill) {
        countPill.textContent = `${filtered.length} User${filtered.length === 1 ? "" : "s"}`;
      }

      if (!filtered.length) {
        emptyState?.classList.remove("hidden");
        return;
      }

      emptyState?.classList.add("hidden");

      filtered.forEach((u) => {
        const id = u.UserID || u.userId || u.user_id || u.User_ID || u.id || "—";
        const name = u.User_Name || u.name || "—";
        const email = u.User_Email || u.email || "—";
        const phone = u.User_Phone_Num || u.userPhoneNum || u.phone || u.phoneNum || "—";
        const role = u.User_Role || u.role || "";
        const badge = roleBadgeClass(role);

        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-100";

        tr.innerHTML = `
          <td class="px-4 py-3 text-sm text-slate-700">${id || "—"}</td>
          <td class="px-4 py-3">
            <div class="font-semibold text-slate-900">${name}</div>
            <div class="text-xs text-slate-500">${email}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${phone}</td>
          <td class="px-4 py-3">
            <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${badge}">
              ${formatRole(role)}
            </span>
          </td>
        `;

        tableBody.appendChild(tr);
      });
    }

    async function loadUsers() {
      try {
        const data = await apiRequest("/user");
        allUsers = Array.isArray(data) ? data : [];
        renderUsers();
      } catch (err) {
        console.error("Failed to load users:", err);
        allUsers = [];
        renderUsers();
        alert("Failed to load users.");
      }
    }

    // ---------- Events ----------
    toggleCreate?.addEventListener("click", () => {
      createPanel?.classList.toggle("hidden");
    });

    createRole?.addEventListener("change", setSponsorJoinVisibility);

    createClear?.addEventListener("click", clearCreateUserForm);

    createUserForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      createMsg?.classList.add("hidden");

      const name = String(createName?.value || "").trim();
      const role = normalizeRole(createRole?.value);
      const email = String(createEmail?.value || "").trim();
      const phone = String(createPhone?.value || "").trim();
      const pssw = String(createPassword?.value || "").trim();
      const sponsor_join = String(createSponsorJoin?.value || "").trim();

      if (!name || !role || !email || !phone || !pssw) {
        showMsg(createMsg, "Please fill out all required user fields.", false);
        return;
      }

      try {
        if (createSubmit) {
          createSubmit.disabled = true;
          createSubmit.textContent = "Creating…";
        }

        const payload = { name, role, email, phone, pssw };
        if ((role === "driver" || role === "sponsor") && sponsor_join) {
          payload.sponsor_join = sponsor_join;
        }

        await apiRequest("/user", {
          method: "POST",
          body: payload,
        });

        showMsg(createMsg, "User created successfully.", true);
        clearCreateUserForm();
        await loadUsers();
      } catch (err) {
        console.error("Failed to create user:", err);
        const detail = err?.data?.detail;
        const msg =
          (typeof detail === "string" && detail) ||
          detail?.message ||
          err?.message ||
          "Failed to create user.";
        showMsg(createMsg, msg, false);
      } finally {
        if (createSubmit) {
          createSubmit.disabled = false;
          createSubmit.textContent = "Create User";
        }
      }
    });

    toggleSponsorOrg?.addEventListener("click", () => {
      sponsorOrgPanel?.classList.toggle("hidden");
    });

    sponsorOrgClear?.addEventListener("click", clearSponsorOrgForm);

    sponsorOrgForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      sponsorOrgMsg?.classList.add("hidden");

      const name = String(sponsorOrgName?.value || "").trim();
      const email = String(sponsorOrgEmail?.value || "").trim();
      const phone = String(sponsorOrgPhone?.value || "").trim();
      const description = String(sponsorOrgDescription?.value || "").trim();

      if (!name || !email || !phone) {
        showMsg(
          sponsorOrgMsg,
          "Please fill out organization name, email, and phone.",
          false
        );
        return;
      }

      try {
        if (sponsorOrgSubmit) {
          sponsorOrgSubmit.disabled = true;
          sponsorOrgSubmit.textContent = "Creating…";
        }

        await apiRequest("/sponsor", {
          method: "POST",
          body: { name, email, phone, description },
        });

        showMsg(sponsorOrgMsg, "Sponsor organization created successfully.", true);
        clearSponsorOrgForm();
      } catch (err) {
        console.error("Failed to create sponsor organization:", err);
        const detail = err?.data?.detail;
        const msg =
          (typeof detail === "string" && detail) ||
          detail?.message ||
          err?.message ||
          "Failed to create sponsor organization.";
        showMsg(sponsorOrgMsg, msg, false);
      } finally {
        if (sponsorOrgSubmit) {
          sponsorOrgSubmit.disabled = false;
          sponsorOrgSubmit.textContent = "Create Organization";
        }
      }
    });

    searchInput?.addEventListener("input", renderUsers);
    roleFilter?.addEventListener("change", renderUsers);
    refreshBtn?.addEventListener("click", loadUsers);

    // ---------- Init ----------
    setSponsorJoinVisibility();
    loadUsers();
  });
})();