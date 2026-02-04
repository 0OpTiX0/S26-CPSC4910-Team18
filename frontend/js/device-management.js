document.addEventListener('DOMContentLoaded', () => 
{
    const deviceContainer = document.getElementById('device-container');
    const logoutAllBtn = document.getElementById('logout-all');

    deviceContainer.addEventListener('click', (e) => 
    {
        if (e.target.classList.contains('logout-single')) 
        {
            const confirmed = confirm("Are you sure you want to log out this device remotely?");
        
            if (confirmed) 
            {
                const card = e.target.closest('.device-card');
                card.style.transform = 'scale(0.95)';
                card.style.opacity = '0';
            
                setTimeout(() => 
                {
                    card.remove();
                }, 300);
            
            }
        }
    });

    logoutAllBtn.addEventListener('click', () => 
    {
        const confirmed = confirm("This will log you out of every device except the one you are using right now. Proceed?");
        
        if (confirmed) 
        {
            const otherDevices = document.querySelectorAll('.device-card');
            
            otherDevices.forEach((card, index) => 
            {
                setTimeout(() => 
                {
                    card.style.transform = 'scale(0.95)';
                    card.style.opacity = '0';
                    setTimeout(() => card.remove(), 300);
                }, index * 100);
            });

            logoutAllBtn.innerText = "All other sessions cleared";
            logoutAllBtn.classList.replace('text-slate-500', 'text-emerald-500');
            logoutAllBtn.classList.replace('border-slate-200', 'border-emerald-200');
            logoutAllBtn.disabled = true;
        }
    });
});