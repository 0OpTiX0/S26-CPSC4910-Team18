document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('applications-list');
    const storedUser = JSON.parse(localStorage.getItem('gd_user'));

    if (!storedUser) 
    {
        window.location.href = 'login.html';
        return;
    }

    try 
    {
        const apps = await window.API.request(`/application?applicant_email=${storedUser.email}`);
        
        const sponsors = await window.API.request('/sponsors');
        const sponsorMap = Object.fromEntries(sponsors.map(s => [s.Sponsor_ID, s.Sponsor_Name]));

        listContainer.innerHTML = ''; 

        if (apps.length === 0) 
        {
            listContainer.innerHTML = `<p class="text-slate-500 text-center py-10">No applications found.</p>`;
            return;
        }

        apps.forEach(app => 
        {
            const date = new Date(app.Submitted_At).toLocaleDateString('en-US', 
            {
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
    } catch (error) 
    {
        listContainer.innerHTML = `<p class="text-red-500 text-center">Failed to load applications.</p>`;
    }
});