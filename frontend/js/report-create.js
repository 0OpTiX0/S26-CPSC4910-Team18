document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reportForm');
  const categoryEl = document.getElementById('reportCategory');
  const issueTypeEl = document.getElementById('reportIssueType');
  const descriptionEl = document.getElementById('reportDescription');
  const statusEl = document.getElementById('reportStatus');
  const submitBtn = document.getElementById('submitReportBtn');
  const backLink = document.getElementById('reportBackLink');

  function safeParse(s) {
    try { return s ? JSON.parse(s) : null; } catch { return null; }
  }

  function getStoredUser() {
    return safeParse(sessionStorage.getItem('gd_user')) || safeParse(localStorage.getItem('gd_user'));
  }

  const session = getStoredUser();
  if (!session?.userId) {
    window.location.href = 'login.html';
    return;
  }

  if (backLink) {
    backLink.href = document.referrer && !document.referrer.endsWith('/create-report.html') ? document.referrer : 'index.html';
  }

  function setStatus(message, kind = 'info') {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.className = 'mt-4 text-sm font-medium ' + (
      kind === 'error' ? 'text-rose-600' :
      kind === 'success' ? 'text-emerald-600' :
      'text-slate-500'
    );
  }

  function getErrorMessage(error) {
    if (error?.data?.detail) {
      if (typeof error.data.detail === 'string') return error.data.detail;
      if (Array.isArray(error.data.detail)) return error.data.detail.map((item) => item?.msg || JSON.stringify(item)).join(', ');
    }
    return error?.message || 'Could not submit report.';
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const category = (categoryEl?.value || '').trim();
    const issueType = (issueTypeEl?.value || '').trim();
    const issueDescription = (descriptionEl?.value || '').trim();

    if (!category || !issueType || !issueDescription) {
      setStatus('Please complete every field before submitting.', 'error');
      return;
    }

    try {
      submitBtn?.setAttribute('disabled', 'disabled');
      submitBtn?.classList.add('opacity-70', 'cursor-not-allowed');
      setStatus('Submitting your report...');

      await window.API.request('/report', {
        method: 'POST',
        body: {
          userID: Number(session.userId),
          category,
          issue_type: issueType,
          issue_description: issueDescription,
          created_at: new Date().toISOString(),
          status: 'Open'
        }
      });

      form.reset();
      setStatus('Report submitted successfully. Thanks for the feedback.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(getErrorMessage(error), 'error');
    } finally {
      submitBtn?.removeAttribute('disabled');
      submitBtn?.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  });
});
