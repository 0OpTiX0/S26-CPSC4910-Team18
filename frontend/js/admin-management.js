// frontend/js/admin-management.js

function safeParse(s) {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

function getStoredUser() {
  return safeParse(localStorage.getItem("gd_user")) || safeParse(sessionStorage.getItem("gd_user"));
}

function showMsg(el, msg, ok = true) {
  if (!el) return;
  el.textContent = String(msg);
  el.classList.remove("hidden");
  el.classList.toggle("text-green-600", !!ok);
  el.classList.toggle("text-red-600", !ok);
}

function normalizeRole(r) {
  const role = (r || "").toString().toLowerCase();
  if (role.includes("driver")) return "driver";
  if (role.includes("sponsor")) return "sponsor";
  if (role.includes("admin")) return "admin";
  return role || "unknown";
}

function roleBadge(role) {
  const r = normalizeRole(role);
  if (r === "driver") return { cls: "bg-blue-100 text-blue-700", label: "Driver" };
  if (r === "sponsor") return { cls: "bg-amber-100 text-amber-800", label: "Sponsor" };
  if (r === "admin") return { cls: "bg-indigo-100 text-indigo-700", label: "Admin" };
  return { cls: "bg-slate-100 text-slate-700", label: r || "Unknown" };
}

document.addEventListener("DOMContentLoaded", async () => {
  const me = getStoredUser();
  if (!me) { window.location.href = "login.html"; return; }

  const myRole = normalizeRole(me.role);
  if (myRole !== "admin") {
    window.location.href = "index.html";
    return;
  }

  const tbody = document.getElementById("users-tbody");
  const search = document.getElementById("user-search");
  const filterBtns = Array.from(document.querySelectorAll(".role-filter"));

  const toggleCreate = document.getElementById("toggle-create");
  const createPanel = document.getElementById("create-panel");

  const form = document.getElementById("create-user-form");
  const nameEl = document.getElementById("cu-name");
  const roleEl = document.getElementById("cu-role");
  const emailEl = document.getElementById("cu-email");
  const phoneEl = document.getElementById("cu-phone");
  const passEl = document.getElementById("cu-pass");
  const msgEl = document.getElementById("cu-msg");
  const clearBtn = document.getElementById("cu-clear");
  const submitBtn = document.getElementById("cu-submit");

  let allUsers = [];
  let activeRoleFilter = "all";

  toggleCreate?.addEventListener("click", () => {
    createPanel?.classList.toggle("hidden");
  });

  clearBtn?.addEventListener("click", () => {
    if (nameEl) nameEl.value = "";
    if (emailEl) emailEl.value = "";
    if (phoneEl) phoneEl.value = "";
    if (passEl) passEl.value = "";
    if (roleEl) roleEl.value = "driver";
    msgEl?.classList.add("hidden");
  });

  async function fetchUsers() {
    const data = await window.API.request("/user");
    return Array.isArray(data) ? data : [];
  }

  function matchesSearch(u, q) {
    if (!q) return true;
    const s = q.toLowerCase();
    const name = (u.User_Name || "").toLowerCase();
    const email = (u.User_Email || "").toLowerCase();
    const phone = (u.User_Phone_Num || "").toLowerCase();
    return name.includes(s) || email.includes(s) || phone.includes(s);
  }

  function matchesRole(u, role) {
    if (role === "all") return true;
    return normalizeRole(u.User_Role) === role;
  }

  function render() {
    if (!tbody) return;

    const q = (search?.value || "").trim();
    const filtered = allUsers
      .filter(u => matchesRole(u, activeRoleFilter))
      .filter(u => matchesSearch(u, q));

    tbody.innerHTML = "";

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="px-6 py-6 text-slate-500" colspan="4">No users found.</td>
        </tr>
      `;
      return;
    }

    for (const u of filtered) {
      const badge = roleBadge(u.User_Role);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-6 py-4">
          <div class="font-bold text-slate-900">${u.User_Name || "—"}</div>
          <div class="text-xs text-slate-500">${u.User_Email || "—"}</div>
        </td>
        <td class="px-6 py-4">
          <span class="px-2 py-1 ${badge.cls} rounded-md text-[10px] font-bold uppercase">${badge.label}</span>
        </td>
        <td class="px-6 py-4 text-slate-700">${u.User_Phone_Num || "—"}</td>
        <td class="px-6 py-4 text-right text-slate-500">${u.UserID ?? "—"}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => {
        b.classList.remove("bg-white", "shadow-sm", "font-bold");
        b.classList.add("text-slate-600");
      });
      btn.classList.add("bg-white", "shadow-sm", "font-bold");
      btn.classList.remove("text-slate-600");

      activeRoleFilter = btn.dataset.role || "all";
      render();
    });
  });

  search?.addEventListener("input", render);

  // Create user flow
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl?.classList.add("hidden");

    const name = (nameEl?.value || "").trim();
    const role = (roleEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const phone = (phoneEl?.value || "").trim();
    const pssw = passEl?.value || "";

    if (!name || !role || !email || !phone || !pssw) {
      showMsg(msgEl, "Please fill out all fields.", false);
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating…";
      }

      await window.API.request("/user", {
        method: "POST",
        body: { name, role, email, phone, pssw }
      });

      showMsg(msgEl, "User created successfully.", true);

      allUsers = await fetchUsers();
      render();

      if (passEl) passEl.value = "";
    } catch (err) {
      console.error(err);
      const detail = err?.data?.detail;
      const msg =
        (typeof detail === "string" && detail) ||
        detail?.message ||
        err?.message ||
        "Failed to create user.";
      showMsg(msgEl, msg, false);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create User";
      }
    }
  });

  // initial load
  try {
    allUsers = await fetchUsers();
    render();
  } catch (e) {
    console.error(e);
    if (tbody) {
      tbody.innerHTML = `
        <tr><td class="px-6 py-6 text-red-600" colspan="4">Failed to load users. Check API_BASE and backend logs.</td></tr>
      `;
    }
  }
});
