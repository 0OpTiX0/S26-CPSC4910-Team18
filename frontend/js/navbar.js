// frontend/js/navbar.js
(function () {
  const STORAGE_KEY = "gd_view_as_driver";

  function safeParse(s) {
    try { return s ? JSON.parse(s) : null; } catch { return null; }
  }

  function getStoredUser() {
    return safeParse(sessionStorage.getItem("gd_user")) || safeParse(localStorage.getItem("gd_user"));
  }

  function getBaseRole(user = getStoredUser()) {
    return String(user?.role || "").toLowerCase();
  }

  function isSponsorFamilyRole(role = getBaseRole()) {
    return role === "sponsor" || role === "sponsor_user";
  }

  function isDriverViewActive(user = getStoredUser()) {
    return isSponsorFamilyRole(getBaseRole(user)) && sessionStorage.getItem(STORAGE_KEY) === "1";
  }

  function getEffectiveRole(user = getStoredUser()) {
    const baseRole = getBaseRole(user);
    return isSponsorFamilyRole(baseRole) && isDriverViewActive(user) ? "driver" : baseRole;
  }

  function setDriverView(active) {
    if (active) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  }

  function exitDriverViewOnLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function hideEl(el) {
    el?.classList.add("hidden");
  }

  function showEl(el) {
    el?.classList.remove("hidden");
  }

  function updateDriverViewControls(user = getStoredUser()) {
    const enabled = isDriverViewActive(user);
    document.querySelectorAll("[data-driver-view-toggle]").forEach((btn) => {
      btn.textContent = enabled ? "Exit Driver View" : "Switch to Driver View";
      btn.dataset.driverViewActive = enabled ? "1" : "0";
      btn.classList.toggle("bg-blue-600", !enabled);
      btn.classList.toggle("text-white", !enabled);
      btn.classList.toggle("hover:bg-blue-700", !enabled);
      btn.classList.toggle("bg-amber-100", enabled);
      btn.classList.toggle("text-amber-800", enabled);
      btn.classList.toggle("hover:bg-amber-200", enabled);
    });
  }

  function ensureDriverViewButton(user = getStoredUser()) {
    if (!isSponsorFamilyRole(getBaseRole(user))) return;

    const dropdown = document.getElementById("profile-dropdown");
    if (dropdown && !dropdown.querySelector("[data-driver-view-toggle]")) {
      const actionsGroup = dropdown.querySelector(".py-2") || dropdown;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-driver-view-toggle", "1");
      btn.className = "w-full text-left px-4 py-2 text-sm font-medium transition";
      actionsGroup.insertBefore(btn, actionsGroup.firstChild);
    }

    const headerNav = document.querySelector("header nav");
    if (headerNav && !headerNav.querySelector("[data-driver-view-toggle-link]")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-driver-view-toggle", "1");
      btn.setAttribute("data-driver-view-toggle-link", "1");
      btn.className = "text-sm font-semibold px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all";
      headerNav.appendChild(btn);
    }

    updateDriverViewControls(user);
  }

  function ensureDriverViewBanner(user = getStoredUser()) {
    const existing = document.getElementById("driver-view-banner");
    if (existing) existing.remove();

    if (!isSponsorFamilyRole(getBaseRole(user)) || !isDriverViewActive(user)) return;

    const banner = document.createElement("div");
    banner.id = "driver-view-banner";
    banner.className = "bg-amber-50 border-b border-amber-200 text-amber-900";
    banner.innerHTML = `
      <div class="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
        <div>
          <strong>Driver View is on.</strong>
          You are previewing the site as a driver while staying signed in as a sponsor user.
        </div>
        <button type="button" data-driver-view-toggle="1" class="px-3 py-1.5 rounded-lg font-semibold transition"></button>
      </div>
    `;

    const body = document.body;
    const first = body.firstElementChild;
    if (first) body.insertBefore(banner, first);
    else body.appendChild(banner);

    updateDriverViewControls(user);
  }

  function applyRolePermissions(role) {
    document.querySelectorAll(".role-specific").forEach((el) => el.classList.add("hidden"));
    if (role) {
      document.querySelectorAll(`.role-${role}`).forEach((el) => el.classList.remove("hidden"));
    }
  }

  function configureNavbarForRole(role) {
    const navStore = document.getElementById("nav-store");
    const navSponsors = document.getElementById("nav-sponsors");
    const navStatus = document.getElementById("nav-status");
    const navSuspend = document.getElementById("nav-suspend");
    const navModify = document.getElementById("nav-modify");
    const navMarket = document.getElementById("nav-market");
    const navReports = document.getElementById("nav-reports");
    const navBulkUpload = document.getElementById("nav-bulk-upload");
    const navAbout = document.getElementById("nav-about");

    // Start by hiding everything role-sensitive
    hideEl(navStore);
    hideEl(navSponsors);
    hideEl(navStatus);
    hideEl(navSuspend);
    hideEl(navModify);
    hideEl(navMarket);
    hideEl(navReports);
    hideEl(navBulkUpload);

    // About should always stay visible
    showEl(navAbout);

    // Guest or driver view
    if (!role || role === "driver") {
      showEl(navStore);
      showEl(navSponsors);
      showEl(navStatus);
      return;
    }

    // Sponsor / sponsor_user
    if (role === "sponsor" || role === "sponsor_user") {
      showEl(navSuspend);
      showEl(navModify);
      showEl(navMarket);
      showEl(navReports);
      showEl(navBulkUpload);
      return;
    }

    // Admin
    if (role === "admin") {
      showEl(navReports);
      showEl(navBulkUpload);
      return;
    }
  }

  function rewriteStatusLink(role) {
    const statusLink = document.getElementById("nav-status")
      || document.querySelector('a[href="view-status.html"], a[href="sponsor_applications.html"]');

    if (!statusLink) return;

    if (role === "sponsor" || role === "sponsor_user") {
      statusLink.textContent = "Application View";
      statusLink.href = "sponsor_applications.html";
    } else if (role === "driver") {
      statusLink.textContent = "Application Status";
      statusLink.href = "view-status.html";
    } else if (role === "admin") {
      statusLink.classList.add("hidden");
    }
  }

  async function updatePointsDisplay(user) {
    if (!user?.userId || !window.CONFIG) return;

    try {
      let sponsorId = window.GDDriverSponsors?.getActiveSponsorId?.() || null;
      if (!sponsorId && window.GDDriverSponsors?.ensureActiveSponsor) {
        const ctx = await window.GDDriverSponsors.ensureActiveSponsor(user);
        sponsorId = ctx?.activeSponsor?.id || null;
      }
      if (!sponsorId) return;

      const response = await fetch(`${CONFIG.API_BASE_URL}/points/${user.userId}?sponsor_id=${encodeURIComponent(sponsorId)}`);
      if (!response.ok) return;

      const data = await response.json();
      const points = typeof data === "number" ? data : (data.total_points || 0);

      const dropdownPointsEl = document.getElementById("dropdown-points");
      if (dropdownPointsEl) dropdownPointsEl.textContent = points;

      const storeBalanceEl = document.getElementById("display-points");
      if (storeBalanceEl) storeBalanceEl.textContent = points;
    } catch (err) {
      console.error("Failed to fetch points:", err);
    }
  }

  async function mountDriverSponsorSwitcher(user) {
    const baseRole = getBaseRole(user);
    if (baseRole !== "driver") return;
    if (!window.GDDriverSponsors?.renderSelector) return;

    let container = document.getElementById("gd-driver-sponsor-switcher-bar");
    if (!container) {
      const chrome = document.querySelector("header, nav");
      if (!chrome) return;
      container = document.createElement("div");
      container.id = "gd-driver-sponsor-switcher-bar";
      container.className = "max-w-6xl mx-auto px-6 py-4";
      chrome.insertAdjacentElement("afterend", container);
    }

    await window.GDDriverSponsors.renderSelector(container, {
      user,
      label: "Active Sponsor",
      helpText: "Switch sponsors to view the correct market, balance, and rewards context."
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const profileBtn = document.getElementById("profile-btn");
    const dropdown = document.getElementById("profile-dropdown");
    const storedUser = getStoredUser();
    const navGuest = document.getElementById("nav-guest");
    const navUser = document.getElementById("nav-user");

    if (!storedUser) {
      navGuest?.classList.remove("hidden");
      navUser?.classList.add("hidden");
      configureNavbarForRole("");
      return;
    }

    navGuest?.classList.add("hidden");
    navUser?.classList.remove("hidden");
    navUser?.classList.add("flex");

    const name = storedUser.name || "";
    const initials = name.trim()
      ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("")
      : "U";

    if (profileBtn) profileBtn.textContent = initials;

    const userNameEl = document.getElementById("user-name");
    const userEmailEl = document.getElementById("user-email");
    if (userNameEl) userNameEl.textContent = storedUser.name || "User";
    if (userEmailEl) userEmailEl.textContent = storedUser.email || "";

    const effectiveRole = getEffectiveRole(storedUser);

    applyRolePermissions(effectiveRole);
    configureNavbarForRole(effectiveRole);
    rewriteStatusLink(effectiveRole);
    ensureDriverViewButton(storedUser);
    ensureDriverViewBanner(storedUser);

    if (window.GDNotifications?.renderBell) {
      window.GDNotifications.renderBell();
    }

    if (effectiveRole === "driver") {
      mountDriverSponsorSwitcher(storedUser);
      const points = storedUser.points || 0;
      const pointsElement = document.getElementById("user-points");
      const progressElement = document.getElementById("points-progress");

      if (pointsElement) pointsElement.textContent = Number(points).toLocaleString();

      if (progressElement) {
        const percentage = Math.min((Number(points) / 1000) * 100, 100);
        setTimeout(() => {
          progressElement.style.width = `${percentage}%`;
        }, 200);
      }

      if (getBaseRole(storedUser) === "driver") {
        const checkConfigAndLoad = () => {
          if (typeof CONFIG !== "undefined") updatePointsDisplay(storedUser);
          else setTimeout(checkConfigAndLoad, 100);
        };
        checkConfigAndLoad();
      }
    }

    window.addEventListener("gd:active-sponsor-changed", () => {
      if (effectiveRole === "driver") {
        updatePointsDisplay(storedUser);
      }
    });

    document.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-driver-view-toggle]");
      if (toggle && isSponsorFamilyRole(getBaseRole(storedUser))) {
        e.preventDefault();
        setDriverView(!isDriverViewActive(storedUser));
        window.location.reload();
        return;
      }
    });

    profileBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle("hidden");
    });

    window.addEventListener("click", () => {
      if (dropdown && !dropdown.classList.contains("hidden")) {
        dropdown.classList.add("hidden");
      }
    });

    document.getElementById("logout-btn")?.addEventListener("click", () => {
      sessionStorage.removeItem("gd_user");
      localStorage.removeItem("gd_user");
      exitDriverViewOnLogout();
      window.location.href = "index.html";
    });
  });

  window.GDUserView = {
    getStoredUser,
    getBaseRole,
    getEffectiveRole,
    isSponsorFamilyRole,
    isDriverViewActive,
    setDriverView,
    applyRolePermissions,
  };
})();