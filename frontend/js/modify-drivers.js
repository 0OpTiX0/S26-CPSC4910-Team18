document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('driverListContainer');
    const countPill = document.getElementById('driverCount');
    const session = JSON.parse(sessionStorage.getItem("gd_user") || sessionStorage.getItem("gd_user"));

    if (!session) {
        window.location.href = "login.html";
        return;
    }

    // 1. Resolve Sponsor (works for sponsor users as well)
    async function getMySponsor() {
        const sponsor = await window.API.request(`/sponsor-user/resolve?email=${encodeURIComponent(session.email)}`);
        return sponsor;
    }

    // 2. Fetch and Render CURRENT partnered drivers (not just approved applications)
    async function loadDrivers() {
        try {
            const sponsor = await getMySponsor();
            const sponsorEmail = sponsor?.Sponsor_Email || sponsor?.sponsor_email;
            if (!sponsorEmail) throw new Error("Sponsor not linked");

            const drivers = await window.API.request(`/sponsors/${encodeURIComponent(sponsorEmail)}/drivers`);

            listContainer.innerHTML = '';
            countPill.textContent = `${(drivers || []).length} Total`;

            if (!drivers || drivers.length === 0) {
                listContainer.innerHTML = `<p class="p-12 text-center text-slate-400 italic">No partnered drivers found.</p>`;
                return;
            }

            // Create each row
            for (const d of drivers) {
                const driverId = d?.UserID ?? d?.user_id;
                const email = d?.Email ?? d?.email;
                const points = d?.Points ?? d?.points ?? 0;

                const row = document.createElement('div');
                row.className = "p-6 flex items-center justify-between hover:bg-slate-50 transition-colors";

                row.innerHTML = `
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-900">${email}</span>
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Driver ID: #${driverId}</span>
                    </div>

                    <div class="flex items-center gap-3">
                        <div class="text-right mr-2">
                            <span class="block text-[10px] text-slate-400 uppercase font-bold">Balance</span>
                            <span id="pts-${driverId}" class="text-xl font-black text-slate-900">${points} <span class="text-xs text-slate-400 font-medium">pts</span></span>
                        </div>

                        <button onclick="adjustPoints(${driverId}, '${email}')" 
                                class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all">
                            Adjust
                        </button>

                        <button onclick="dropDriver('${sponsorEmail}', '${email}')" 
                                class="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-00 shadow-md active:scale-95 transition-all">
                            Drop
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
    // Global drop function (uses existing DELETE /sponsors/drop_driver endpoint)
    window.dropDriver = async (sponsorEmail, driverEmail) => {
        const reason = prompt(`Drop ${driverEmail} from your sponsor program?\nOptional: enter a reason (or leave blank):`, "");
        if (reason === null) return; // user canceled

        try {
            const qs = new URLSearchParams();
            qs.set("sponsor_email", sponsorEmail);
            qs.set("user_email", driverEmail);
            if (reason && reason.trim()) qs.set("drop_reason", reason.trim());

            await window.API.request(`/sponsors/drop_driver?${qs.toString()}`, { method: "DELETE" });
            await loadDrivers();
        } catch (err) {
            console.error(err);
            alert("Could not drop driver. Make sure the driver is currently linked to your sponsor.");
        }
    };

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