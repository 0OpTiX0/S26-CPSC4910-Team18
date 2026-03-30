(() => {
  const PAGE_NAME = 'admin-reports.html';

  function safeParse(value) {
    try { return value ? JSON.parse(value) : null; } catch { return null; }
  }

  function getStoredUser() {
    return safeParse(sessionStorage.getItem('gd_user')) || safeParse(localStorage.getItem('gd_user'));
  }

  function escHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] || char));
  }

  function getErrorMessage(error, fallback = 'API request failed') {
    if (error?.data?.detail) {
      if (Array.isArray(error.data.detail)) {
        return error.data.detail.map((item) => item?.msg || JSON.stringify(item)).join(', ');
      }
      if (typeof error.data.detail === 'string') {
        return error.data.detail;
      }
    }
    return error?.message || fallback;
  }

  function getApiBase() {
    let configBase = 'http://127.0.0.1:8000';
    if (window.CONFIG && window.CONFIG.API_BASE_URL) configBase = window.CONFIG.API_BASE_URL;
    return String(configBase).replace(/\/+$/, '');
  }

  function buildUrl(path, params = {}) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${getApiBase()}${cleanPath}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  async function downloadCsv(path, params = {}) {
    const response = await fetch(buildUrl(path, params));
    if (!response.ok) {
      const text = await response.text();
      let parsed = text;
      try { parsed = text ? JSON.parse(text) : null; } catch {}
      const error = new Error('Download failed');
      error.status = response.status;
      error.data = parsed;
      throw error;
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1] || 'report.csv';

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  }

  function setGlobalStatus(message, kind = 'info') {
    const el = document.getElementById('globalStatus');
    if (!el) return;
    if (!message) {
      el.className = 'hidden rounded-2xl border px-4 py-3 text-sm font-medium';
      el.textContent = '';
      return;
    }
    const base = 'rounded-2xl border px-4 py-3 text-sm font-medium';
    const map = {
      info: ' bg-blue-50 border-blue-200 text-blue-700',
      success: ' bg-emerald-50 border-emerald-200 text-emerald-700',
      error: ' bg-rose-50 border-rose-200 text-rose-700'
    };
    el.className = base + (map[kind] || map.info);
    el.textContent = message;
  }

  function populateSelect(selectEl, options, allLabel) {
    if (!selectEl) return;
    const rows = [];
    if (allLabel) rows.push(`<option value="">${escHtml(allLabel)}</option>`);
    rows.push(...options.map((option) => `
      <option value="${escHtml(option.value)}">${escHtml(option.label)}</option>
    `));
    selectEl.innerHTML = rows.join('');
  }

  async function getSponsorContext(user) {
    const sponsor = await window.API.request(`/sponsor-user/resolve?email=${encodeURIComponent(user.email)}`);
    const sponsorId = sponsor?.Sponsor_ID ?? sponsor?.sponsor_id;
    const sponsorEmail = sponsor?.Sponsor_Email ?? sponsor?.sponsor_email ?? user.email;
    const sponsorshipsRaw = await window.API.request(`/sponsors/${encodeURIComponent(sponsorEmail)}/drivers?sponsor_id=${encodeURIComponent(sponsorId)}`).catch((error) => {
      if (error?.status === 404) return [];
      throw error;
    });
    const driverUsersRaw = await window.API.request('/driver').catch(() => []);
    const usersRaw = await window.API.request('/user?userRole=Driver').catch(() => []);

    const sponsorships = Array.isArray(sponsorshipsRaw) ? sponsorshipsRaw : [];
    const driverUsers = Array.isArray(driverUsersRaw) ? driverUsersRaw : [];
    const users = Array.isArray(usersRaw) ? usersRaw : [];

    const driverMap = new Map(driverUsers.map((driver) => [
      Number(driver?.Registered_Driver ?? driver?.registered_driver),
      driver
    ]));
    const userMap = new Map(users.map((driver) => [
      Number(driver?.UserID ?? driver?.user_id),
      driver
    ]));

    return sponsorships.map((membership) => {
      const driverId = Number(membership?.Driver_User_ID ?? membership?.driver_user_id ?? membership?.Registered_Driver ?? membership?.registered_driver);
      const driverRow = driverMap.get(driverId) || {};
      const userRow = userMap.get(driverId) || {};
      return {
        driverId,
        name: driverRow?.Driver_Name ?? driverRow?.driver_name ?? userRow?.User_Name ?? userRow?.user_name ?? `Driver #${driverId}`,
        email: userRow?.User_Email ?? userRow?.user_email ?? 'No email found'
      };
    }).filter((driver) => Number.isFinite(driver.driverId));
  }

  async function getAdminDrivers() {
    const [driverUsersRaw, usersRaw] = await Promise.all([
      window.API.request('/driver').catch(() => []),
      window.API.request('/user?userRole=Driver').catch(() => [])
    ]);
    const driverUsers = Array.isArray(driverUsersRaw) ? driverUsersRaw : [];
    const users = Array.isArray(usersRaw) ? usersRaw : [];
    const userMap = new Map(users.map((user) => [Number(user?.UserID ?? user?.user_id), user]));
    return driverUsers.map((driver) => {
      const driverId = Number(driver?.Registered_Driver ?? driver?.registered_driver);
      const userRow = userMap.get(driverId) || {};
      return {
        driverId,
        name: driver?.Driver_Name ?? driver?.driver_name ?? userRow?.User_Name ?? userRow?.user_name ?? `Driver #${driverId}`,
        email: userRow?.User_Email ?? userRow?.user_email ?? 'No email found'
      };
    }).filter((driver) => Number.isFinite(driver.driverId));
  }

  async function getAllUsers() {
    const allUsersRaw = await window.API.request('/user').catch(() => []);
    const allUsers = Array.isArray(allUsersRaw) ? allUsersRaw : [];
    return allUsers.map((user) => ({
      userId: Number(user?.UserID ?? user?.user_id),
      name: user?.User_Name ?? user?.user_name ?? 'Unknown User',
      email: user?.User_Email ?? user?.user_email ?? 'No email',
      role: user?.User_Role ?? user?.user_role ?? 'unknown'
    })).filter((user) => Number.isFinite(user.userId));
  }

  function updateSponsorDriverSummary(drivers) {
    const selectEl = document.getElementById('sponsorDriverSelect');
    const countEl = document.getElementById('sponsorDriverCount');
    const idEl = document.getElementById('sponsorDriverId');
    const emailEl = document.getElementById('sponsorDriverEmail');
    if (!selectEl) return;

    const selected = drivers.find((driver) => String(driver.driverId) === String(selectEl.value)) || drivers[0] || null;
    if (selected && !selectEl.value) selectEl.value = String(selected.driverId);
    countEl.textContent = `${drivers.length} Drivers`;
    idEl.textContent = selected ? selected.driverId : '—';
    emailEl.textContent = selected ? selected.email : '—';
  }

  function updateAdminDriverSummary(drivers) {
    const selectEl = document.getElementById('adminDriverSelect');
    const idEl = document.getElementById('adminDriverId');
    const emailEl = document.getElementById('adminDriverEmail');
    if (!selectEl) return;
    const selected = drivers.find((driver) => String(driver.driverId) === String(selectEl.value)) || null;
    idEl.textContent = selected ? selected.driverId : 'All Drivers';
    emailEl.textContent = selected ? selected.email : 'All Drivers';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = getStoredUser();
    let sponsorAllowedDriverIds = new Set();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    const role = String(user.role || '').toLowerCase();
    const isSponsor = role.includes('sponsor');
    const isAdmin = role === 'admin';

    if (!isSponsor && !isAdmin) {
      alert('Only sponsor and admin users can access reports.');
      window.location.href = 'index.html';
      return;
    }

    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const roleBadge = document.getElementById('roleBadge');
    const sponsorPanel = document.getElementById('sponsorPanel');
    const adminPanel = document.getElementById('adminPanel');

    roleBadge.textContent = isAdmin ? 'Admin Reports' : 'Sponsor Reports';
    roleBadge.classList.remove('hidden');
    pageTitle.textContent = isAdmin ? 'Admin Reports' : 'Sponsor Reports';
    pageSubtitle.textContent = isAdmin
      ? 'Download every CSV export the current backend exposes for admin users.'
      : 'Download per-driver CSV exports for the drivers tied to your sponsor account.';

    let sponsorDrivers = [];
    let adminDrivers = [];
    let allUsers = [];

    try {
      if (isSponsor) {
        sponsorPanel.classList.remove('hidden');
        sponsorDrivers = await getSponsorContext(user);
        sponsorAllowedDriverIds = new Set(sponsorDrivers.map((driver) => String(driver.driverId)));

        populateSelect(
          document.getElementById('sponsorDriverSelect'),
          sponsorDrivers.map((driver) => ({
            value: String(driver.driverId),
            label: `${driver.name} (#${driver.driverId})`
          }))
        );
        updateSponsorDriverSummary(sponsorDrivers);

        document.getElementById('sponsorDriverSelect')?.addEventListener('change', () => {
          updateSponsorDriverSummary(sponsorDrivers);
        });
      }

      if (isAdmin) {
        adminPanel.classList.remove('hidden');
        [adminDrivers, allUsers] = await Promise.all([getAdminDrivers(), getAllUsers()]);

        populateSelect(
          document.getElementById('adminDriverSelect'),
          adminDrivers.map((driver) => ({ value: String(driver.driverId), label: `${driver.name} (#${driver.driverId})` })),
          'All drivers'
        );
        populateSelect(
          document.getElementById('adminUserSelect'),
          allUsers.map((account) => ({ value: String(account.userId), label: `${account.name} (${account.role})` })),
          'All users'
        );
        populateSelect(
          document.getElementById('bugUserSelect'),
          allUsers.map((account) => ({ value: String(account.userId), label: `${account.name} (${account.role})` })),
          'Any user'
        );

        updateAdminDriverSummary(adminDrivers);
        document.getElementById('adminDriverSelect')?.addEventListener('change', () => {
          updateAdminDriverSummary(adminDrivers);
        });
      }

      if (isSponsor && sponsorDrivers.length === 0) {
        setGlobalStatus('No sponsor-linked drivers were found. The report buttons will stay disabled until a driver is linked to this sponsor.', 'info');
      }
    } catch (error) {
      console.error(error);
      setGlobalStatus(getErrorMessage(error, 'Unable to load report filters.'), 'error');
    }

    document.querySelectorAll('[data-download]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.download;
        const originalText = button.textContent;

        try {
          setGlobalStatus('Preparing download...', 'info');
          button.disabled = true;
          button.textContent = 'Preparing...';

          if (action.startsWith('sponsor-')) {
            const driverId = document.getElementById('sponsorDriverSelect')?.value;
            if (!driverId) {
              throw new Error('Please select one of your drivers first.');
            }
            if (!sponsorAllowedDriverIds.has(String(driverId))) {
              throw new Error('That driver is not linked to your sponsor account.');
            }

            if (action === 'sponsor-transactions') {
              await downloadCsv('/driver/transaction_report_csv', { driver_id: driverId });
            } else if (action === 'sponsor-decisions') {
              await downloadCsv('/application/decision_report_csv', { driver_id: driverId });
            } else if (action === 'sponsor-password') {
              await downloadCsv('/user/password_report_csv', { driver_id: driverId });
            } else if (action === 'sponsor-bugs') {
              await downloadCsv('/report/bug_report_csv', { user: driverId });
            }
          }

          if (action.startsWith('admin-')) {
            const driverId = document.getElementById('adminDriverSelect')?.value;
            const userId = document.getElementById('adminUserSelect')?.value;
            const bugUserId = document.getElementById('bugUserSelect')?.value;
            const bugAuditId = document.getElementById('bugAuditId')?.value.trim();
            const bugCategory = document.getElementById('bugCategory')?.value.trim();
            const bugStatus = document.getElementById('bugStatus')?.value;

            if (action === 'admin-transactions') {
              await downloadCsv('/driver/transaction_report_csv', { driver_id: driverId });
            } else if (action === 'admin-decisions') {
              await downloadCsv('/application/decision_report_csv', { driver_id: driverId });
            } else if (action === 'admin-password') {
              await downloadCsv('/user/password_report_csv', { driver_id: userId });
            } else if (action === 'admin-bugs') {
              await downloadCsv('/report/bug_report_csv', {
                auditID: bugAuditId,
                user: bugUserId,
                category: bugCategory,
                status: bugStatus
              });
            }
          }

          setGlobalStatus('CSV download started.', 'success');
        } catch (error) {
          console.error(error);
          setGlobalStatus(getErrorMessage(error, 'Download failed.'), 'error');
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
  });
})();
