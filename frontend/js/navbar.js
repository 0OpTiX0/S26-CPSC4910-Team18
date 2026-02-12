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