document.addEventListener('DOMContentLoaded', async () => 
{
    const profileBtn = document.getElementById('profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    const storedUser = JSON.parse(localStorage.getItem('gd_user'));

    if (storedUser) 
    {
        document.getElementById('nav-guest')?.classList.add('hidden');
        document.getElementById('nav-user')?.classList.remove('hidden');
        document.getElementById('nav-user')?.classList.add('flex');

        if (profileBtn) 
        {
            profileBtn.textContent = storedUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
        }
        document.getElementById('user-name').textContent = storedUser.name;
        document.getElementById('user-email').textContent = storedUser.email;

        const userRole = storedUser.role ? storedUser.role.toLowerCase() : null;
        applyRolePermissions(userRole);

        if (userRole === 'driver') 
        {
            const points = storedUser.points || 0;
            const pointsElement = document.getElementById('user-points');
            const progressElement = document.getElementById('points-progress');

            if (pointsElement) pointsElement.textContent = points.toLocaleString();
            if (progressElement) 
            {
                const percentage = Math.min((points / 1000) * 100, 100);
                setTimeout(() => progressElement.style.width = `${percentage}%`, 300);
            }
        }

        const points = storedUser.points || 0;
        const pointsElement = document.getElementById('user-points');
        const progressElement = document.getElementById('points-progress');

        if (pointsElement) pointsElement.textContent = points.toLocaleString();

        if (progressElement) 
        {
            const percentage = Math.min((points / 1000) * 100, 100);
            setTimeout(() => progressElement.style.width = `${percentage}%`, 300);
        }

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

function applyRolePermissions(role) 
{
    document.querySelectorAll('.role-specific').forEach(el => el.classList.add('hidden'));

    if (role) 
    {
        document.querySelectorAll(`.role-${role}`).forEach(el => el.classList.remove('hidden'));
    }
}