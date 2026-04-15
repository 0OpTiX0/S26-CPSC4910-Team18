document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('applications-list');
    const selectorHost = document.getElementById('driver-sponsor-status-switcher');
    const storedUser = JSON.parse(sessionStorage.getItem('gd_user') || localStorage.getItem('gd_user') || 'null');
    const effectiveRole = window.GDUserView?.getEffectiveRole(storedUser) || String(storedUser?.role || '').toLowerCase();
    const driverPreview = !!window.GDUserView?.isDriverViewActive?.(storedUser);

    if (!storedUser) {
        window.location.href = 'login.html';
        return;
    }

    if (effectiveRole !== 'driver') {
        window.location.href = 'index.html';
        return;
    }

    async function renderApplications() {
        if (driverPreview) {
            listContainer.innerHTML = `
                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 text-center">
                    <h2 class="text-xl font-bold mb-2">Driver Application Status Preview</h2>
                    <p class="text-sm">Sponsor users can open this page in Driver View, but real application history is only shown for actual driver accounts.</p>
                </div>
            `;
            return;
        }

        try {
            if (selectorHost && window.GDDriverSponsors?.renderSelector) {
                await window.GDDriverSponsors.renderSelector(selectorHost, {
                    user: storedUser,
                    label: 'Selected Sponsor',
                    helpText: 'Application results below are filtered to the sponsor you currently have selected.'
                });
            }

            const activeSponsorId = window.GDDriverSponsors?.getActiveSponsorId?.() || null;
            const apps = await window.API.request(`/application?applicant_email=${encodeURIComponent(storedUser.email)}`);
            const sponsors = await window.API.request('/sponsors');
            const sponsorMap = Object.fromEntries(sponsors.map(s => [s.Sponsor_ID, s.Sponsor_Name]));

            const filteredApps = activeSponsorId
                ? apps.filter((app) => Number(app.Sponsor_ID) === Number(activeSponsorId))
                : apps;

            listContainer.innerHTML = '';

            if (filteredApps.length === 0) {
                listContainer.innerHTML = `<p class="text-slate-500 text-center py-10">No applications found for the selected sponsor.</p>`;
                return;
            }

            filteredApps.forEach(app => {
                const date = new Date(app.Submitted_At).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                });

                const statusClass = app.Applicant_Status === 'Approved' ? 'bg-green-100 text-green-700' :
                                  app.Applicant_Status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700';

                listContainer.innerHTML += `
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 class="text-xl font-bold text-slate-900">${sponsorMap[app.Sponsor_ID] || 'Unknown Sponsor'}</h2>
                            <p class="text-sm text-slate-500">Submitted on ${date}</p>
                            ${app.Rejection_Reason ? `<p class="mt-2 text-sm text-red-600 font-medium">Reason: ${app.Rejection_Reason}</p>` : ''}
                        </div>
                        <span class="px-4 py-1.5 rounded-full text-sm font-bold ${statusClass}">
                            ${app.Applicant_Status}
                        </span>
                    </div>
                `;
            });
        } catch (error) {
            console.error(error);
            listContainer.innerHTML = `<p class="text-red-500 text-center">Failed to load applications.</p>`;
        }
    }

    window.addEventListener('gd:active-sponsor-changed', renderApplications);
    renderApplications();
});
