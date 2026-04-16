document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('driverListContainer');
    const countPill = document.getElementById('driverCount');
    const actionPanel = document.getElementById('driverActionPanel');
    const placeholder = document.getElementById('statusPanelPlaceholder');
    
    // Inputs
    const suspendMinutesInput = document.getElementById('suspendMinutes');
    const suspendReasonInput = document.getElementById('suspendReason');
    const suspendBtn = document.getElementById('suspendDriverBtn');
    const actionStatus = document.getElementById('actionStatus');
    
    const session = JSON.parse(sessionStorage.getItem('gd_user') || 'null');

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    let selectedDriver = null;
    let currentSponsorId = null;

    const escHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char] || char));

    async function getMySponsor() {
        return window.GDUserView?.resolveSponsorContext?.(session);
    }

    async function loadDrivers() {
        try {
            const sponsor = await getMySponsor();
            currentSponsorId = sponsor?.Sponsor_ID ?? sponsor?.sponsor_id;
            const sponsorEmail = sponsor?.Sponsor_Email ?? sponsor?.sponsor_email ?? session.email;

            if (!currentSponsorId) throw new Error('Sponsor ID not found');

            const [sponsorships, driverUsers, users] = await Promise.all([
                window.API.request(`/sponsors/${encodeURIComponent(sponsorEmail)}/drivers?sponsor_id=${encodeURIComponent(currentSponsorId)}`),
                window.API.request('/driver'),
                window.API.request('/user?userRole=Driver')
            ]);

            const driverMap = new Map(driverUsers.map(d => [Number(d.Registered_Driver || d.registered_driver), d]));
            const userMap = new Map(users.map(u => [Number(u.UserID || u.user_id), u]));

            const mergedDrivers = sponsorships.map(membership => {
                const dId = Number(membership.Driver_User_ID || membership.Registered_Driver);
                const dRow = driverMap.get(dId) || {};
                const uRow = userMap.get(dId) || {};

                return {
                    ...membership,
                    driverId: dId,
                    User_Name: dRow.Driver_Name || uRow.User_Name || `Driver #${dId}`,
                    User_Email: uRow.User_Email || uRow.user_email || 'No email found'
                };
            });
            
            countPill.textContent = mergedDrivers.length;
            listContainer.innerHTML = '';

            if (mergedDrivers.length === 0) {
                listContainer.innerHTML = '<div class="p-8 text-center text-slate-400 italic text-sm">No drivers found.</div>';
                return;
            }

            mergedDrivers.forEach(driver => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group border-l-4 border-transparent';
                
                const isSuspended = driver.Membership_Status?.toLowerCase() === 'suspended';
                const statusColor = isSuspended ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

                btn.innerHTML = `
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">${escHtml(driver.User_Name)}</span>
                        <span class="text-xs text-slate-400">${escHtml(driver.User_Email)}</span>
                    </div>
                    <span class="text-[10px] font-bold uppercase px-2 py-1 rounded ${statusColor}">
                        ${escHtml(driver.Membership_Status || 'Active')}
                    </span>
                `;

                btn.onclick = (e) => selectDriver(driver, e.currentTarget);
                listContainer.appendChild(btn);
            });

        } catch (err) {
            console.error(err);
            listContainer.innerHTML = `<div class="p-4 text-red-500 text-xs">Error loading drivers.</div>`;
        }
    }

    function selectDriver(driver, element) {
        selectedDriver = driver;
        placeholder.classList.add('hidden');
        actionPanel.classList.remove('hidden');

        document.getElementById('selectedDriverName').textContent = driver.User_Name;
        document.getElementById('selectedDriverEmail').textContent = driver.User_Email;

        const isSuspended = driver.Membership_Status?.toLowerCase() === 'suspended';
        const badge = document.getElementById('statusBadge');
        badge.textContent = isSuspended ? 'Suspended' : 'Active';
        badge.className = isSuspended 
            ? 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700'
            : 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700';

        actionStatus.textContent = '';
        
        Array.from(listContainer.children).forEach(child => child.classList.remove('bg-blue-50', 'border-blue-500'));
        if (element) element.classList.add('bg-blue-50', 'border-blue-500');
    }

    suspendBtn.onclick = async () => {
        if (!selectedDriver || !currentSponsorId) return;

        const minutes = parseInt(suspendMinutesInput.value, 10);
        const reason = suspendReasonInput.value.trim();

        try {
            actionStatus.textContent = 'Processing...';

            // Construct the URL with Query Parameters to match your backend
            const url = `/sponsors/suspend_driver?` + 
                        `sponsor_id=${Number(currentSponsorId)}&` +
                        `driver_email=${encodeURIComponent(selectedDriver.User_Email)}&` +
                        `reason=${encodeURIComponent(reason || "No reason provided")}&` +
                        `duration_minutes=${minutes}`;

            // Send the request with NO body, just the URL
            await window.API.request(url, {
                method: 'PATCH'
            });

            actionStatus.textContent = 'Driver successfully suspended.';
            actionStatus.className = 'mt-4 text-center text-xs font-bold text-emerald-600';

            await loadDrivers(); 
            
            setTimeout(() => {
                actionPanel.classList.add('hidden');
                placeholder.classList.remove('hidden');
            }, 2000);

        } catch (err) {
            console.error("API Error:", err);
            actionStatus.textContent = 'Error: ' + (err.message || 'API request failed');
            actionStatus.className = 'mt-4 text-center text-xs font-bold text-rose-600';
        }
    };

    loadDrivers();
});