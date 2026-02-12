document.addEventListener('DOMContentLoaded', async () => 
{
    const profileBtn = document.getElementById('profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    const storedUser = JSON.parse(localStorage.getItem('gd_user'));

    if (storedUser) 
    {
        // 1. Show User Nav and Hide Guest Nav
        document.getElementById('nav-guest')?.classList.add('hidden');
        document.getElementById('nav-user')?.classList.remove('hidden');
        document.getElementById('nav-user')?.classList.add('flex'); // Ensure flex is applied

        // 2. Set Profile Initials and Info
        if (profileBtn) {
            profileBtn.textContent = storedUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
        }
        document.getElementById('user-name').textContent = storedUser.name;
        document.getElementById('user-email').textContent = storedUser.email;

        // 3. Fetch Application Status from FastAPI
        fetchAppStatus(storedUser.email);
    }

    // 4. Toggle Dropdown on Click
    profileBtn?.addEventListener('click', (e) => {
        // Stop click from bubbling up to the window listener
        e.stopPropagation();
        dropdown?.classList.toggle('hidden');
    });

    // 5. Close Dropdown when clicking anywhere else on the screen
    window.addEventListener('click', (e) => {
        if (dropdown && !dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
        }
    });

    // 6. Handle Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('gd_user');
        window.location.href = 'index.html';
    });
});

async function fetchAppStatus(email) {
    const loading = document.getElementById('status-loading');
    const content = document.getElementById('status-content');

    try {
        // Hits your @app.get("/application") endpoint
        const apps = await window.API.request(`/application?applicant_email=${email}`);
        
        if (!apps || apps.length === 0) {
            loading.textContent = "No active applications";
            return;
        }

        const latest = apps[0]; // Driver_Application model
        loading.classList.add('hidden');
        content.classList.remove('hidden');

        // Map data from Driver_Application model
        document.getElementById('app-status-badge').textContent = latest.Applicant_Status;
        document.getElementById('app-date').textContent = new Date(latest.Submitted_At).toLocaleDateString();
        
        // Fetch Sponsor name using Sponsor_ID
        const sponsors = await window.API.request('/sponsors');
        const sponsor = sponsors.find(s => s.Sponsor_ID === latest.Sponsor_ID);
        document.getElementById('app-sponsor').textContent = sponsor ? sponsor.Sponsor_Name : 'Unknown Sponsor';

        // Dynamic badge styling
        const badge = document.getElementById('app-status-badge');
        badge.className = `px-2 py-0.5 rounded-full text-[10px] font-bold ${
            latest.Applicant_Status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`;
    } catch (err) {
        if (loading) loading.textContent = "Error loading status";
    }
}