// frontend/js/navbar.js
(function () {
  const PREVIEW_ROLE_KEY = "gd_preview_role";
  const ADMIN_PREVIEW_SPONSOR_KEY = "gd_admin_preview_sponsor_id";

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

  function getAllowedPreviewRoles(user = getStoredUser()) {
    const baseRole = getBaseRole(user);
    if (baseRole === 'admin') return ['sponsor', 'driver'];
    if (isSponsorFamilyRole(baseRole)) return ['driver'];
    return [];
  }

  function getPreviewRole(user = getStoredUser()) {
    const role = String(sessionStorage.getItem(PREVIEW_ROLE_KEY) || '').toLowerCase();
    return getAllowedPreviewRoles(user).includes(role) ? role : null;
  }

  function getEffectiveRole(user = getStoredUser()) {
    return getPreviewRole(user) || getBaseRole(user);
  }

  function isDriverViewActive(user = getStoredUser()) {
    return getEffectiveRole(user) === 'driver' && getBaseRole(user) !== 'driver';
  }

  function isSponsorViewActive(user = getStoredUser()) {
    return getBaseRole(user) === 'admin' && getEffectiveRole(user) === 'sponsor';
  }

  function setPreviewRole(role) {
    const normalized = String(role || '').toLowerCase();
    const user = getStoredUser();
    if (normalized && getAllowedPreviewRoles(user).includes(normalized)) {
      sessionStorage.setItem(PREVIEW_ROLE_KEY, normalized);
    } else {
      sessionStorage.removeItem(PREVIEW_ROLE_KEY);
    }
  }

  function setDriverView(active) {
    setPreviewRole(active ? 'driver' : null);
  }

  function exitPreviewOnLogout() {
    sessionStorage.removeItem(PREVIEW_ROLE_KEY);
    sessionStorage.removeItem(ADMIN_PREVIEW_SPONSOR_KEY);
  }

  function hideEl(el) { el?.classList.add('hidden'); }
  function showEl(el) { el?.classList.remove('hidden'); }

  async function fetchAllSponsors() {
    if (!window.API?.request) return [];
    try {
      const rows = await window.API.request('/sponsors');
      return Array.isArray(rows) ? rows.map((s) => ({
        id: Number(s?.Sponsor_ID ?? s?.sponsor_id ?? s?.id ?? 0),
        name: s?.Sponsor_Name ?? s?.sponsor_name ?? s?.name ?? 'Unknown Sponsor',
        email: s?.Sponsor_Email ?? s?.sponsor_email ?? s?.email ?? '',
        phone: s?.Sponsor_Phone_Num ?? s?.Sponsor_PhoneNum ?? s?.phone ?? ''
      })).filter((s) => Number.isFinite(s.id) && s.id > 0) : [];
    } catch (err) {
      console.error('Failed to fetch sponsors for preview:', err);
      return [];
    }
  }

  function getAdminPreviewSponsorId() {
    const id = Number(sessionStorage.getItem(ADMIN_PREVIEW_SPONSOR_KEY) || localStorage.getItem(ADMIN_PREVIEW_SPONSOR_KEY));
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  function setAdminPreviewSponsorId(sponsorId) {
    const id = Number(sponsorId);
    if (!Number.isFinite(id) || id <= 0) return;
    sessionStorage.setItem(ADMIN_PREVIEW_SPONSOR_KEY, String(id));
    localStorage.setItem(ADMIN_PREVIEW_SPONSOR_KEY, String(id));
    window.dispatchEvent(new CustomEvent('gd:admin-preview-sponsor-changed', { detail: { sponsorId: id } }));
  }

  async function resolveSponsorContext(user = getStoredUser()) {
    const baseRole = getBaseRole(user);
    const effectiveRole = getEffectiveRole(user);

    if (effectiveRole !== 'sponsor' && effectiveRole !== 'sponsor_user') return null;

    if (baseRole === 'admin') {
      const sponsors = await fetchAllSponsors();
      if (!sponsors.length) return null;

      let sponsor = sponsors.find((s) => s.id === getAdminPreviewSponsorId()) || sponsors[0];
      if (sponsor) setAdminPreviewSponsorId(sponsor.id);

      return {
        Sponsor_ID: sponsor.id,
        sponsor_id: sponsor.id,
        Sponsor_Name: sponsor.name,
        sponsor_name: sponsor.name,
        Sponsor_Email: sponsor.email,
        sponsor_email: sponsor.email,
        Sponsor_Phone_Num: sponsor.phone,
        sponsor_phone_num: sponsor.phone,
      };
    }

    if (baseRole === 'sponsor') {
      const email =
        user?.email ||
        user?.userEmail ||
        user?.User_Email ||
        user?.user_email ||
        '';

      if (!email) {
        console.error('resolveSponsorContext: no sponsor email found on stored user', user);
        return null;
      }

      const sponsor = await window.API.request(
        `/sponsor-user/resolve?email=${encodeURIComponent(email)}`
      );

      if (!sponsor) {
        console.error('resolveSponsorContext: no sponsor found for email', email, sponsor);
        return null;
      }

      return {
        Sponsor_ID: sponsor?.Sponsor_ID ?? sponsor?.sponsor_id,
        sponsor_id: sponsor?.Sponsor_ID ?? sponsor?.sponsor_id,
        Sponsor_Name: sponsor?.Sponsor_Name ?? sponsor?.sponsor_name,
        sponsor_name: sponsor?.Sponsor_Name ?? sponsor?.sponsor_name,
        Sponsor_Email: sponsor?.Sponsor_Email ?? sponsor?.sponsor_email ?? email,
        sponsor_email: sponsor?.Sponsor_Email ?? sponsor?.sponsor_email ?? email,
        Sponsor_Phone_Num: sponsor?.Sponsor_Phone_Num ?? sponsor?.Sponsor_PhoneNum ?? sponsor?.sponsor_phone_num,
        sponsor_phone_num: sponsor?.Sponsor_Phone_Num ?? sponsor?.Sponsor_PhoneNum ?? sponsor?.sponsor_phone_num,
      };
    }

    // Sponsor user account
    return window.API.request(`/sponsor-user/resolve?email=${encodeURIComponent(user?.email || '')}`);
  }

  function updatePreviewControls(user = getStoredUser()) {
    const mode = getPreviewRole(user);
    document.querySelectorAll('[data-preview-role-toggle]').forEach((btn) => {
      const targetRole = btn.dataset.previewRoleToggle;
      const active = mode === targetRole;
      const labels = {
        sponsor: active ? 'Exit Sponsor View' : 'View as Sponsor',
        driver: active ? 'Exit Driver View' : 'View as Driver'
      };
      btn.textContent = labels[targetRole] || 'Toggle View';
      btn.dataset.previewRoleActive = active ? '1' : '0';
      btn.classList.toggle('bg-blue-600', !active);
      btn.classList.toggle('text-white', !active);
      btn.classList.toggle('hover:bg-blue-700', !active);
      btn.classList.toggle('bg-amber-100', active);
      btn.classList.toggle('text-amber-800', active);
      btn.classList.toggle('hover:bg-amber-200', active);
    });
    document.querySelectorAll('[data-preview-exit]').forEach((btn) => {
      btn.classList.toggle('hidden', !mode);
    });
  }

  function ensurePreviewButtons(user = getStoredUser()) {
    const allowed = getAllowedPreviewRoles(user);
    if (!allowed.length) return;

    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
      const actionsGroup = dropdown.querySelector('.py-2') || dropdown;
      if (!actionsGroup.querySelector('[data-preview-controls]')) {
        const wrap = document.createElement('div');
        wrap.setAttribute('data-preview-controls', '1');
        wrap.className = 'px-3 pb-2 border-b border-slate-100 mb-2 flex flex-col gap-2';
        if (allowed.includes('sponsor')) {
          wrap.insertAdjacentHTML('beforeend', '<button type="button" data-preview-role-toggle="sponsor" class="w-full text-left px-4 py-2 text-sm font-medium rounded-xl transition"></button>');
        }
        if (allowed.includes('driver')) {
          wrap.insertAdjacentHTML('beforeend', '<button type="button" data-preview-role-toggle="driver" class="w-full text-left px-4 py-2 text-sm font-medium rounded-xl transition"></button>');
        }
        wrap.insertAdjacentHTML('beforeend', '<button type="button" data-preview-exit="1" class="hidden w-full text-left px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition">Exit Preview</button>');
        actionsGroup.insertBefore(wrap, actionsGroup.firstChild);
      }
    }

    updatePreviewControls(user);
  }

  function ensurePreviewBanner(user = getStoredUser()) {
    const existing = document.getElementById('preview-mode-banner');
    if (existing) existing.remove();

    document.body.style.paddingTop = '';

    const mode = getPreviewRole(user);
    if (!mode) return;

    const labels = {
      driver: '<strong>Driver View is on.</strong> You are previewing the site as a driver.',
      sponsor: '<strong>Sponsor View is on.</strong> You are previewing the site as a sponsor.'
    };

    const banner = document.createElement('div');
    banner.id = 'preview-mode-banner';
    banner.className = 'fixed top-0 left-0 right-0 z-[100] bg-amber-50 border-b border-amber-200 text-amber-900 shadow-sm';
    banner.innerHTML = `
      <div class="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
        <div>${labels[mode] || 'Preview mode is on.'} Your underlying account is still ${getBaseRole(user)}.</div>
        <button type="button" data-preview-exit="1" class="px-3 py-1.5 rounded-lg font-semibold border border-amber-300 bg-white hover:bg-amber-100 transition">
          Exit Preview
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    // Push page content down so the fixed banner does not cover it
    requestAnimationFrame(() => {
      document.body.style.paddingTop = `${banner.offsetHeight}px`;
    });

    updatePreviewControls(user);
  }

  function applyRolePermissions(role) {
    document.querySelectorAll('.role-specific').forEach((el) => el.classList.add('hidden'));
    if (role) {
      document.querySelectorAll(`.role-${role}`).forEach((el) => el.classList.remove('hidden'));
    }
  }

  function configureNavbarForRole(role) {
    const navStore = document.getElementById('nav-store');
    const navSponsors = document.getElementById('nav-sponsors');
    const navStatus = document.getElementById('nav-status');
    const navSuspend = document.getElementById('nav-suspend');
    const navModify = document.getElementById('nav-modify');
    const navMarket = document.getElementById('nav-market');
    const navReports = document.getElementById('nav-reports');
    const navBulkUpload = document.getElementById('nav-bulk-upload');
    const navAbout = document.getElementById('nav-about');

    [navStore, navSponsors, navStatus, navSuspend, navModify, navMarket, navReports, navBulkUpload].forEach(hideEl);
    showEl(navAbout);

    if (!role || role === 'driver') {
      showEl(navStore); showEl(navSponsors); showEl(navStatus); return;
    }
    if (role === 'sponsor' || role === 'sponsor_user') {
      showEl(navSuspend); showEl(navModify); showEl(navMarket); showEl(navReports); showEl(navBulkUpload); return;
    }
    if (role === 'admin') {
      showEl(navReports); showEl(navBulkUpload);
    }
  }

  function rewriteStatusLink(role) {
    const statusLink = document.getElementById('nav-status') || document.querySelector('a[href="view-status.html"], a[href="sponsor_applications.html"]');
    if (!statusLink) return;
    if (role === 'sponsor' || role === 'sponsor_user') {
      statusLink.textContent = 'Application View'; statusLink.href = 'sponsor_applications.html';
    } else if (role === 'driver') {
      statusLink.textContent = 'Application Status'; statusLink.href = 'view-status.html';
    } else if (role === 'admin') {
      statusLink.classList.add('hidden');
    }
  }

  async function updatePointsDisplay(user) {
    if (!user?.userId) return;

    try {
      let sponsorId = window.GDDriverSponsors?.getActiveSponsorId?.() || null;

      if (!sponsorId && window.GDDriverSponsors?.ensureActiveSponsor) {
        const ctx = await window.GDDriverSponsors.ensureActiveSponsor(user);
        sponsorId = ctx?.activeSponsor?.id || null;
      }

      if (!sponsorId) return;

      const data = await window.API.request(
        `/points/${user.userId}?sponsor_id=${encodeURIComponent(sponsorId)}`
      );

      const points = typeof data === 'number'
        ? data
        : (data.total_points || 0);

      const dropdownPointsEl = document.getElementById('dropdown-points');
      if (dropdownPointsEl) dropdownPointsEl.textContent = points;

      const storeBalanceEl = document.getElementById('display-points');
      if (storeBalanceEl) storeBalanceEl.textContent = points;
    } catch (err) {
      console.error('Failed to fetch points:', err);
    }
  }
  async function mountDriverSponsorSwitcher(user) {
    if (getEffectiveRole(user) !== 'driver') return;
    if (!window.GDDriverSponsors?.renderSelector) return;
    let container = document.getElementById('gd-driver-sponsor-switcher-bar');
    if (!container) {
      const chrome = document.querySelector('header, nav');
      if (!chrome) return;
      container = document.createElement('div');
      container.id = 'gd-driver-sponsor-switcher-bar';
      container.className = 'relative z-[50] max-w-6xl mx-auto px-6 py-4';
      chrome.insertAdjacentElement('afterend', container);
    }
    await window.GDDriverSponsors.renderSelector(container, {
      user,
      label: getBaseRole(user) === 'admin' ? 'Preview Sponsor' : 'Active Sponsor',
      helpText: getBaseRole(user) === 'admin'
        ? 'Admins in Driver View can switch sponsors to preview each rewards experience.'
        : 'Switch sponsors to view the correct market, balance, and rewards context.'
    });
  }

  async function mountAdminSponsorSwitcher(user) {
    if (getBaseRole(user) !== 'admin' || getEffectiveRole(user) !== 'sponsor') return;
    let container = document.getElementById('gd-admin-sponsor-switcher-bar');
    if (!container) {
      const chrome = document.querySelector('header, nav');
      if (!chrome) return;
      container = document.createElement('div');
      container.id = 'gd-admin-sponsor-switcher-bar';
      container.className = 'max-w-6xl mx-auto px-6 py-4';
      chrome.insertAdjacentElement('afterend', container);
    }
    const sponsors = await fetchAllSponsors();
    if (!sponsors.length) {
      container.innerHTML = '<div class="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm text-sm text-slate-500">No sponsors are available for sponsor preview.</div>';
      return;
    }
    let activeId = getAdminPreviewSponsorId();
    let active = sponsors.find((s) => s.id === activeId) || sponsors[0];
    if (active) setAdminPreviewSponsorId(active.id);
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Preview Sponsor</div>
          <div class="text-sm text-slate-500 mt-1">Admins in Sponsor View can switch which sponsor account they are previewing.</div>
        </div>
        <div class="sm:min-w-[18rem]">
          <select id="gd-admin-preview-sponsor-select" class="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none">
            ${sponsors.map((s) => `<option value="${s.id}" ${s.id === active.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    container.querySelector('#gd-admin-preview-sponsor-select')?.addEventListener('change', (event) => {
      setAdminPreviewSponsorId(Number(event.target.value));
      window.location.reload();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const profileBtn = document.getElementById('profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    const storedUser = getStoredUser();
    const navGuest = document.getElementById('nav-guest');
    const navUser = document.getElementById('nav-user');

    if (!storedUser) {
      navGuest?.classList.remove('hidden');
      navUser?.classList.add('hidden');
      configureNavbarForRole('');
      return;
    }

    navGuest?.classList.add('hidden');
    navUser?.classList.remove('hidden');
    navUser?.classList.add('flex');

    const name = storedUser.name || '';
    const initials = name.trim() ? name.trim().split(/\s+/).slice(0,2).map((w) => w[0]?.toUpperCase() || '').join('') : 'U';
    if (profileBtn) profileBtn.textContent = initials;

    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    if (userNameEl) userNameEl.textContent = storedUser.name || 'User';
    if (userEmailEl) userEmailEl.textContent = storedUser.email || '';

    const effectiveRole = getEffectiveRole(storedUser);
    applyRolePermissions(effectiveRole);
    configureNavbarForRole(effectiveRole);
    rewriteStatusLink(effectiveRole);
    ensurePreviewButtons(storedUser);
    ensurePreviewBanner(storedUser);

    if (window.GDNotifications?.renderBell) window.GDNotifications.renderBell();

    if (effectiveRole === 'driver') {
      mountDriverSponsorSwitcher(storedUser);
      if (getBaseRole(storedUser) === 'driver') {
        updatePointsDisplay(storedUser);
      }
    } else if (effectiveRole === 'sponsor') {
      mountAdminSponsorSwitcher(storedUser);
    }

    window.addEventListener('gd:active-sponsor-changed', () => {
      if (getEffectiveRole(storedUser) === 'driver') updatePointsDisplay(storedUser);
    });

    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-preview-role-toggle]');
      if (toggle) {
        e.preventDefault();
        const targetRole = toggle.dataset.previewRoleToggle;
        const active = getPreviewRole(storedUser) === targetRole;
        setPreviewRole(active ? null : targetRole);
        window.location.reload();
        return;
      }
      const exitBtn = e.target.closest('[data-preview-exit]');
      if (exitBtn) {
        e.preventDefault();
        setPreviewRole(null);
        window.location.reload();
      }
    });

    profileBtn?.addEventListener('click', (e) => { e.stopPropagation(); dropdown?.classList.toggle('hidden'); });
    window.addEventListener('click', () => { if (dropdown && !dropdown.classList.contains('hidden')) dropdown.classList.add('hidden'); });
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      sessionStorage.removeItem('gd_user');
      localStorage.removeItem('gd_user');
      exitPreviewOnLogout();
      window.location.href = 'index.html';
    });
  });

  window.GDUserView = {
    getStoredUser,
    getBaseRole,
    getEffectiveRole,
    isSponsorFamilyRole,
    isDriverViewActive,
    isSponsorViewActive,
    getPreviewRole,
    setPreviewRole,
    setDriverView,
    applyRolePermissions,
    fetchAllSponsors,
    getAdminPreviewSponsorId,
    setAdminPreviewSponsorId,
    resolveSponsorContext,
  };
})();
