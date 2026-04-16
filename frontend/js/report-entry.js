(() => {
  function safeParse(s) {
    try { return s ? JSON.parse(s) : null; } catch { return null; }
  }

  function getStoredUser() {
    return safeParse(sessionStorage.getItem('gd_user')) || safeParse(localStorage.getItem('gd_user'));
  }

  function isLoggedIn() {
    return !!getStoredUser();
  }

  function getCurrentPath() {
    return (window.location.pathname || '').split('/').pop() || '';
  }

  function createQuickReportButton() {
    if (!isLoggedIn()) return;
    if (getCurrentPath() === 'create-report.html') return;
    if (document.getElementById('gd-report-fab')) return;

    const btn = document.createElement('a');
    btn.id = 'gd-report-fab';
    btn.href = 'create-report.html';
    btn.className = [
      'fixed bottom-6 right-6 z-[95] px-5 py-3 rounded-2xl',
      'bg-slate-900 text-white text-sm font-bold shadow-xl',
      'hover:bg-blue-600 transition-all active:scale-95'
    ].join(' ');
    btn.textContent = 'Report Issue';
    document.body.appendChild(btn);
  }

  function injectProfileLink() {
    if (!isLoggedIn()) return;
    const dropdown = document.getElementById('profile-dropdown');
    if (!dropdown || dropdown.querySelector('[data-report-link]')) return;

    const actionsGroup = dropdown.querySelector('.py-2') || dropdown;
    const link = document.createElement('a');
    link.href = 'create-report.html';
    link.textContent = 'Report an Issue';
    link.setAttribute('data-report-link', '1');
    link.className = 'block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition';

    const logoutBtn = actionsGroup.querySelector('#logout-btn');
    if (logoutBtn) actionsGroup.insertBefore(link, logoutBtn);
    else actionsGroup.appendChild(link);
  }

  document.addEventListener('DOMContentLoaded', () => {
    createQuickReportButton();
    injectProfileLink();
  });
})();
