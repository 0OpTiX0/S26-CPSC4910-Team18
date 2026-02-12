document.addEventListener('DOMContentLoaded', async () => 
{
    const profileBtn = document.getElementById('profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    const storedUser = JSON.parse(localStorage.getItem('gd_user'));

    if (storedUser) 
    {
        document.getElementById('nav-guest')?.classList.add('hidden');
        document.getElementById('nav-user')?.classList.remove('hidden');
        document.getElementById('nav-user')?.classList.add('flex'); // Ensure flex is applied

        if (profileBtn) {
            profileBtn.textContent = storedUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
        }
        document.getElementById('user-name').textContent = storedUser.name;
        document.getElementById('user-email').textContent = storedUser.email;

        fetchAppStatus(storedUser.email);
    }

    profileBtn?.addEventListener('click', (e) => 
    {
        e.stopPropagation();
        dropdown?.classList.toggle('hidden');
    });

    window.addEventListener('click', (e) => 
    {
        if (dropdown && !dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('gd_user');
        window.location.href = 'index.html';
    });
});

async function fetchAppStatus(email) 
{
    const loading = document.getElementById('status-loading');
    const content = document.getElementById('status-content');

    try {
        const apps = await window.API.request(`/application?applicant_email=${email}`);
        
        if (!apps || apps.length === 0) 
        {
            loading.textContent = "No active applications";
            return;
        }

        const latest = apps[0]; 
        loading.classList.add('hidden');
        content.classList.remove('hidden');

        document.getElementById('app-status-badge').textContent = latest.Applicant_Status;
        document.getElementById('app-date').textContent = new Date(latest.Submitted_At).toLocaleDateString();
        
        const sponsors = await window.API.request('/sponsors');
        const sponsor = sponsors.find(s => s.Sponsor_ID === latest.Sponsor_ID);
        document.getElementById('app-sponsor').textContent = sponsor ? sponsor.Sponsor_Name : 'Unknown Sponsor';

        const badge = document.getElementById('app-status-badge');
        badge.className = `px-2 py-0.5 rounded-full text-[10px] font-bold $
        {
            latest.Applicant_Status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`;
    } catch (err) 
    {
        if (loading) loading.textContent = "Error loading status";
    }
}