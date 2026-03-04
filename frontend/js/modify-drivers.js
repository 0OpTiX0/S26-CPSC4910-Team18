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

    // -------------------------
    // Points Adjustment UI
    // -------------------------
    const editSection = document.getElementById('editSection');
    const selectedDriverNameEl = document.getElementById('selectedDriverName');
    const currentPointsEl = document.getElementById('currentPoints');
    const modeAddBtn = document.getElementById('modeAdd');
    const modeDeductBtn = document.getElementById('modeDeduct');
    const pointsAmountEl = document.getElementById('pointsAmount');
    const pointsReasonEl = document.getElementById('pointsReason');
    const applyPointsBtn = document.getElementById('applyPointsBtn');
    const cancelPointsBtn = document.getElementById('cancelPointsBtn');
    const pointsStatusEl = document.getElementById('pointsStatus');

    // Recent transactions UI
    const transactionsBody = document.getElementById('transactionsBody');
    const transactionsStatusEl = document.getElementById('transactionsStatus');
    const refreshTransactionsBtn = document.getElementById('refreshTransactionsBtn');

    let selectedDriverId = null;
    let selectedDriverEmail = null;
    let mode = 'add'; // 'add' | 'deduct'

    function setTxStatus(msg, kind = 'info') {
        if (!transactionsStatusEl) return;
        transactionsStatusEl.textContent = msg || '';
        transactionsStatusEl.className = 'mt-2 text-sm ' + (
            kind === 'error' ? 'text-rose-600' :
            kind === 'success' ? 'text-emerald-600' :
            'text-slate-500'
        );
    }

    function renderTxRows(rows) {
        if (!transactionsBody) return;
        if (!rows || rows.length === 0) {
            transactionsBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-6 text-center text-slate-400 italic">No point transactions yet for this driver.</td>
                </tr>
            `;
            return;
        }

        // Sort newest first (best-effort)
        const sorted = [...rows].sort((a, b) => {
            const da = new Date(a?.Created_At ?? a?.created_at ?? 0).getTime();
            const db = new Date(b?.Created_At ?? b?.created_at ?? 0).getTime();
            return db - da;
        });

        const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] || c));

        transactionsBody.innerHTML = sorted.slice(0, 15).map(t => {
            const createdRaw = t?.Created_At ?? t?.created_at;
            const created = createdRaw ? new Date(createdRaw) : null;
            const dateStr = created && !Number.isNaN(created.getTime())
                ? created.toLocaleString()
                : esc(createdRaw || '');

            const sponsorName = t?.Sponsor_Name ?? t?.sponsor_name ?? '';
            const reason = t?.Reason_For_Change ?? t?.reason_for_change ?? '';
            const after = t?.Points_After_Change ?? t?.points_after_change ?? '';
            const changeRaw = t?.Points_Change ?? t?.points_change ?? '';
            const changeNum = typeof changeRaw === 'number' ? changeRaw : parseInt(changeRaw, 10);
            const isNeg = !Number.isNaN(changeNum) ? changeNum < 0 : String(changeRaw).trim().startsWith('-');

            const changeCell = `
                <span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${isNeg ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">
                    ${esc(changeRaw)}
                </span>
            `;

            return `
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 whitespace-nowrap text-slate-700">${esc(dateStr)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-slate-700">${esc(sponsorName)}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${changeCell}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-slate-700 font-semibold">${esc(after)}</td>
                    <td class="px-4 py-3 text-slate-700">${esc(reason)}</td>
                </tr>
            `;
        }).join('');
    }

    async function loadTransactions(driverId) {
        if (!driverId) return;
        if (!transactionsBody) return;

        setTxStatus('Loading transactions...');
        transactionsBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-6 text-center text-slate-400">
                    <span class="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent align-[-3px]"></span>
                    <span class="ml-2">Fetching recent changes...</span>
                </td>
            </tr>
        `;

        try {
            const tx = await window.API.request(`/report/transaction/${driverId}`);
            renderTxRows(Array.isArray(tx) ? tx : []);
            setTxStatus('');
        } catch (err) {
            // Backend returns 404 if none exist; treat that as "empty".
            const msg = String(err?.message || '');
            if (msg.includes('404') || msg.toLowerCase().includes('no recent reports')) {
                renderTxRows([]);
                setTxStatus('');
                return;
            }
            console.error(err);
            renderTxRows([]);
            setTxStatus('Could not load transactions for this driver.', 'error');
        }
    }

    function setStatus(msg, kind = 'info') {
        if (!pointsStatusEl) return;
        pointsStatusEl.textContent = msg || '';
        pointsStatusEl.className = 'text-center text-sm font-medium ' + (
            kind === 'error' ? 'text-rose-600' :
            kind === 'success' ? 'text-emerald-600' :
            'text-slate-500'
        );
    }

    function setMode(nextMode) {
        mode = nextMode;
        // Simple active styles
        if (modeAddBtn && modeDeductBtn) {
            if (mode === 'add') {
                modeAddBtn.classList.add('bg-emerald-500', 'text-white');
                modeAddBtn.classList.remove('text-emerald-600');
                modeDeductBtn.classList.remove('bg-rose-500', 'text-white');
                modeDeductBtn.classList.add('text-rose-600');
            } else {
                modeDeductBtn.classList.add('bg-rose-500', 'text-white');
                modeDeductBtn.classList.remove('text-rose-600');
                modeAddBtn.classList.remove('bg-emerald-500', 'text-white');
                modeAddBtn.classList.add('text-emerald-600');
            }
        }
        setStatus('');
    }

    modeAddBtn?.addEventListener('click', () => setMode('add'));
    modeDeductBtn?.addEventListener('click', () => setMode('deduct'));
    cancelPointsBtn?.addEventListener('click', () => {
        editSection?.classList.add('hidden');
        selectedDriverId = null;
        selectedDriverEmail = null;
        pointsAmountEl && (pointsAmountEl.value = '');
        pointsReasonEl && (pointsReasonEl.value = '');
        setStatus('');
        setTxStatus('');
        if (transactionsBody) {
            transactionsBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-6 text-center text-slate-400 italic">Select a driver to view transactions.</td>
                </tr>
            `;
        }
    });

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
        selectedDriverId = driverId;
        selectedDriverEmail = email;

        if (selectedDriverNameEl) selectedDriverNameEl.textContent = email;
        setMode('add');

        // Reset inputs
        if (pointsAmountEl) pointsAmountEl.value = '';
        if (pointsReasonEl) pointsReasonEl.value = '';
        setStatus('');

        // Show panel
        editSection?.classList.remove('hidden');

        // Load current points
        try {
            const pts = await window.API.request(`/points/${driverId}`);
            if (currentPointsEl) currentPointsEl.value = pts;
        } catch (err) {
            if (currentPointsEl) currentPointsEl.value = '';
            setStatus('Could not load current points for this driver.', 'error');
        }

        // Load recent transactions
        loadTransactions(driverId);
    };

    refreshTransactionsBtn?.addEventListener('click', () => {
        if (selectedDriverId) loadTransactions(selectedDriverId);
    });

    applyPointsBtn?.addEventListener('click', async () => {
        if (!selectedDriverId) return;

        const rawAmount = (pointsAmountEl?.value || '').trim();
        const rawReason = (pointsReasonEl?.value || '').trim();

        const amount = parseInt(rawAmount, 10);
        if (!rawAmount || Number.isNaN(amount) || amount <= 0) {
            setStatus('Please enter a positive amount.', 'error');
            return;
        }
        if (!rawReason) {
            setStatus('Reason is required.', 'error');
            return;
        }

        const signedChange = mode === 'deduct' ? -Math.abs(amount) : Math.abs(amount);

        try {
            setStatus('Saving...', 'info');
            await window.API.request('/points', {
                method: 'PATCH',
                body: {
                    driverID: selectedDriverId,
                    points_change: signedChange,
                    reason: rawReason
                }
            });

            const newPoints = await window.API.request(`/points/${selectedDriverId}`);

            // Update list row display
            const ptDisplay = document.getElementById(`pts-${selectedDriverId}`);
            if (ptDisplay) ptDisplay.innerHTML = `${newPoints} <span class="text-xs text-slate-400 font-medium">pts</span>`;
            if (currentPointsEl) currentPointsEl.value = newPoints;

            setStatus('Points updated successfully.', 'success');

            // Refresh recent transactions list
            loadTransactions(selectedDriverId);

            // Keep panel open but clear inputs for quick next entry
            if (pointsAmountEl) pointsAmountEl.value = '';
            if (pointsReasonEl) pointsReasonEl.value = '';
        } catch (err) {
            console.error(err);
            const msg = err?.message || 'Failed to update points.';
            setStatus(msg, 'error');
        }
    });

    loadDrivers();
});