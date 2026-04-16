// frontend/js/driver-sponsor-context.js
(function () {
  const STORAGE_KEY = "gd_active_sponsor_id";
  const PREVIEW_CACHE_KEY = 'gd_preview_driver_sponsors';

  function safeParse(value) {
    try { return value ? JSON.parse(value) : null; } catch { return null; }
  }

  function getStoredUser() {
    return safeParse(sessionStorage.getItem("gd_user")) || safeParse(localStorage.getItem("gd_user"));
  }

  function getCacheKeyForDriver(driverId) {
    return `gd_driver_sponsors_${driverId}`;
  }

  function normalizeSponsors(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((sponsor) => ({
        id: sponsor?.Sponsor_ID ?? sponsor?.sponsor_id ?? sponsor?.id ?? null,
        name: sponsor?.Sponsor_Name ?? sponsor?.sponsor_name ?? sponsor?.name ?? "Unknown Sponsor",
        email: sponsor?.Sponsor_Email ?? sponsor?.sponsor_email ?? sponsor?.email ?? "",
        phone: sponsor?.Sponsor_Phone_Num ?? sponsor?.Sponsor_PhoneNum ?? sponsor?.phone ?? "",
      }))
      .filter((s) => Number.isFinite(Number(s.id)) && Number(s.id) > 0)
      .map((s) => ({ ...s, id: Number(s.id) }));
  }

  function clearSponsorStateForDriver(driverId) {
    if (driverId) {
      const cacheKey = getCacheKeyForDriver(driverId);
      sessionStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheKey);
    }
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }

  async function fetchSponsorsForDriver(driverId) {
    if (!driverId || !window.API?.request) return [];
    const cacheKey = getCacheKeyForDriver(driverId);
    try {
      const response = await window.API.request(`/admin/get_sponsor_list?driver_id=${encodeURIComponent(driverId)}`);
      const sponsors = normalizeSponsors(response);
      sessionStorage.setItem(cacheKey, JSON.stringify(sponsors));
      localStorage.setItem(cacheKey, JSON.stringify(sponsors));
      if (!sponsors.length) {
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      }
      return sponsors;
    } catch (err) {
      sessionStorage.setItem(cacheKey, JSON.stringify([]));
      localStorage.setItem(cacheKey, JSON.stringify([]));
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  async function fetchSponsorsForPreview() {
    if (!window.GDUserView?.fetchAllSponsors) return [];
    const sponsors = normalizeSponsors(await window.GDUserView.fetchAllSponsors());
    sessionStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(sponsors));
    localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(sponsors));
    if (!sponsors.length) {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    }
    return sponsors;
  }

  function getCachedSponsors(driverId) {
    if (driverId) {
      const cacheKey = getCacheKeyForDriver(driverId);
      return normalizeSponsors(safeParse(sessionStorage.getItem(cacheKey)) || safeParse(localStorage.getItem(cacheKey)) || []);
    }
    return normalizeSponsors(safeParse(sessionStorage.getItem(PREVIEW_CACHE_KEY)) || safeParse(localStorage.getItem(PREVIEW_CACHE_KEY)) || []);
  }

  function getActiveSponsorId() {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  function dispatchSponsorChange(sponsorId, sponsor) {
    window.dispatchEvent(new CustomEvent('gd:active-sponsor-changed', { detail: { sponsorId, sponsor } }));
  }

  function setActiveSponsorId(sponsorId, options = {}) {
    const id = Number(sponsorId);
    if (!Number.isFinite(id) || id <= 0) return;
    sessionStorage.setItem(STORAGE_KEY, String(id));
    localStorage.setItem(STORAGE_KEY, String(id));
    const user = getStoredUser();
    const sponsors = getCachedSponsors(user?.userId);
    const sponsor = sponsors.find((item) => Number(item.id) === id) || null;
    if (!options.silent) dispatchSponsorChange(id, sponsor);
  }

  async function ensureActiveSponsor(user = getStoredUser()) {
    const baseRole = String(user?.role || '').toLowerCase();
    const effectiveRole = window.GDUserView?.getEffectiveRole?.(user) || baseRole;
    if (!user?.userId || effectiveRole !== 'driver') {
      return { sponsors: [], activeSponsor: null, activeSponsorId: null };
    }

    const isPreviewDriver = baseRole !== 'driver';
    let sponsors = getCachedSponsors(isPreviewDriver ? null : user.userId);
    if (!sponsors.length) {
      sponsors = isPreviewDriver ? await fetchSponsorsForPreview() : await fetchSponsorsForDriver(user.userId);
    }
    if (!sponsors.length) {
      clearSponsorStateForDriver(isPreviewDriver ? null : user.userId);
      return { sponsors: [], activeSponsor: null, activeSponsorId: null };
    }

    let activeId = getActiveSponsorId();
    let activeSponsor = sponsors.find((item) => item.id === activeId) || null;
    if (!activeSponsor) {
      activeSponsor = sponsors[0];
      setActiveSponsorId(activeSponsor.id, { silent: true });
      activeId = activeSponsor.id;
    }
    return { sponsors, activeSponsor, activeSponsorId: activeId };
  }

  function getSavedMarketIdForSponsor(sponsorId) {
    const id = Number(sponsorId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const raw = localStorage.getItem(`gd_market_id_sponsor_${id}`);
    const marketId = Number(raw);
    return Number.isFinite(marketId) && marketId > 0 ? marketId : null;
  }

  async function renderSelector(container, options = {}) {
    if (!container) return;
    const user = options.user || getStoredUser();
    const ctx = await ensureActiveSponsor(user);
    if (!ctx.sponsors.length) {
      container.classList.remove('hidden');
      container.innerHTML = `
        <div class="${options.compact ? 'flex items-center gap-3' : 'bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'}">
          <div>
            <div class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">${options.label || 'Active Sponsor'}</div>
            ${options.compact ? '' : `<div class="text-sm text-slate-500 mt-1">No sponsor context is available for this view.</div>`}
          </div>
          <div class="inline-flex items-center gap-2 rounded-xl bg-slate-100 text-slate-500 px-3 py-2 text-sm font-bold border border-slate-200">
            <span>No sponsor available</span>
          </div>
        </div>`;
      return;
    }

    const compact = !!options.compact;
    const label = options.label || 'Active Sponsor';
    const helpText = options.helpText || 'Switch sponsors to view the correct market, balance, and rewards context.';
    const single = ctx.sponsors.length === 1;
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="${compact ? 'flex items-center gap-3' : 'bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'}">
        <div>
          <div class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">${label}</div>
          ${compact ? '' : `<div class="text-sm text-slate-500 mt-1">${helpText}</div>`}
        </div>
        <div class="${compact ? '' : 'sm:min-w-[18rem]'}">
          ${single ? `<div class="inline-flex items-center gap-2 rounded-xl bg-blue-50 text-blue-700 px-3 py-2 text-sm font-bold border border-blue-100"><span>${ctx.activeSponsor.name}</span></div>` : `<select id="gd-active-sponsor-select" class="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none">${ctx.sponsors.map((s) => `<option value="${s.id}" ${s.id === ctx.activeSponsor.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>`}
        </div>
      </div>`;
    const select = container.querySelector('#gd-active-sponsor-select');
    if (select) {
      select.addEventListener('change', (event) => {
        const nextId = Number(event.target.value);
        if (!Number.isFinite(nextId) || nextId <= 0) return;
        setActiveSponsorId(nextId);
      });
    }
  }

  window.GDDriverSponsors = {
    getStoredUser,
    fetchSponsorsForDriver,
    fetchSponsorsForPreview,
    getCachedSponsors,
    getActiveSponsorId,
    setActiveSponsorId,
    ensureActiveSponsor,
    getSavedMarketIdForSponsor,
    renderSelector,
    clearSponsorStateForDriver,
  };
})();
