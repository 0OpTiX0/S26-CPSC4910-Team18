document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('driverListContainer');
    const countPill = document.getElementById('driverCount');
    const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user"));

    if (!session) {
        window.location.href = "login.html";
        return;
    }

    // 1. Resolve Sponsor ID
    async function getMySponsorId() {
        try {
            const sponsor = await window.API.request(`/sponsor-user/resolve?email=${encodeURIComponent(session.email)}`);
            return sponsor?.Sponsor_ID || sponsor?.sponsor_id;
        } catch (err) { return null; }
    }

    // 2. Fetch and Render
    async function loadDrivers() {
        try {
            const sponsorId = await getMySponsorId();
            if (!sponsorId) throw new Error("Sponsor not linked");

            const apps = await window.API.request(`/application?sponsor_id=${sponsorId}`);
            const approved = apps.filter(a => a.Applicant_Status === "Approved");
            
            listContainer.innerHTML = '';
            countPill.textContent = `${approved.length} Total`;

            if (approved.length === 0) {
                listContainer.innerHTML = `<p class="p-12 text-center text-slate-400 italic">No approved drivers found.</p>`;
                return;
            }

            // Create each row
            for (const driver of approved) {
                const row = document.createElement('div');
                row.className = "p-6 flex items-center justify-between hover:bg-slate-50 transition-colors";
                
                // Fetch points for this specific driver
                let points = 0;
                try {
                    points = await window.API.request(`/points/${driver.Applicant_ID}`);
                } catch (e) { points = "N/A"; }

                row.innerHTML = `
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-900">${driver.Applicant_Email}</span>
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Driver ID: #${driver.Applicant_ID}</span>
                    </div>
                    
                    <div class="flex items-center gap-6">
                        <div class="text-right">
                            <span class="block text-[10px] text-slate-400 uppercase font-bold">Balance</span>
                            <span id="pts-${driver.Applicant_ID}" class="text-xl font-black text-slate-900">${points} <span class="text-xs text-slate-400 font-medium">pts</span></span>
                        </div>
                        <button onclick="adjustPoints(${driver.Applicant_ID}, '${driver.Applicant_Email}')" 
                                class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all">
                            Adjust
                        </button>
                    </div>
                `;
                listContainer.appendChild(row);
            }
        } catch (error) {
            listContainer.innerHTML = `<p class="p-12 text-center text-red-500">Error: ${error.message}</p>`;
        }
    }

    // Global function so the button onclick can find it
    window.adjustPoints = async (driverId, email) => {
        const change = prompt(`Adjust points for ${email}:\nEnter amount to add (e.g. 100) or subtract (e.g. -50):`, "100");
        if (!change || isNaN(change)) return;

        try {
            await window.API.request("/points", {
                method: "PATCH",
                body: {
                    driverID: driverId,
                    points_change: parseInt(change),
                    reason: "Sponsor manual update"
                }
            });
            
            // Immediately update the text in the UI
            const newPoints = await window.API.request(`/points/${driverId}`);
            const ptDisplay = document.getElementById(`pts-${driverId}`);
            if (ptDisplay) ptDisplay.innerHTML = `${newPoints} <span class="text-xs text-slate-400 font-medium">pts</span>`;
            
        } catch (err) {
            alert("Failed to update points. Check console for details.");
        }
    };

    loadDrivers();
});