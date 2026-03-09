document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('driverListContainer');
    const countPill = document.getElementById('driverCount');
    const session = JSON.parse(sessionStorage.getItem('gd_user') || 'null');

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const escHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char] || char));

    function getErrorMessage(error, fallback = 'API request failed') {
        if (error?.data?.detail) {
            if (Array.isArray(error.data.detail)) {
                return error.data.detail.map((item) => item?.msg || JSON.stringify(item)).join(', ');
            }
            if (typeof error.data.detail === 'string') {
                return error.data.detail;
            }
        }
        return error?.message || fallback;
    }

    async function getMySponsor() {
        return window.API.request(`/sponsor-user/resolve?email=${encodeURIComponent(session.email)}`);
    }

    async function loadDrivers() {
        try {
            const sponsor = await getMySponsor();
            const sponsorId = sponsor?.Sponsor_ID ?? sponsor?.sponsor_id;
            const sponsorEmail = sponsor?.Sponsor_Email ?? sponsor?.sponsor_email ?? session.email;

            if (!sponsorId) {
                throw new Error('Sponsor not linked');
            }

            const [sponsorshipsRaw, driverUsersRaw, usersRaw] = await Promise.all([
                window.API.request(`/sponsors/${encodeURIComponent(sponsorEmail)}/drivers?sponsor_id=${encodeURIComponent(sponsorId)}`).catch((error) => {
                    if (error?.status === 404) return [];
                    throw error;
                }),
                window.API.request('/driver'),
                window.API.request('/user?userRole=Driver')
            ]);

            const sponsorships = Array.isArray(sponsorshipsRaw) ? sponsorshipsRaw : [];
            const driverUsers = Array.isArray(driverUsersRaw) ? driverUsersRaw : [];
            const users = Array.isArray(usersRaw) ? usersRaw : [];

            const driverMap = new Map(driverUsers.map((driver) => [
                Number(driver?.Registered_Driver ?? driver?.registered_driver),
                driver
            ]));
            const userMap = new Map(users.map((user) => [
                Number(user?.UserID ?? user?.user_id),
                user
            ]));

            const mergedDrivers = sponsorships.map((membership) => {
                const driverId = Number(membership?.Driver_User_ID ?? membership?.driver_user_id ?? membership?.Registered_Driver ?? membership?.registered_driver);
                const driverRow = driverMap.get(driverId) || {};
                const userRow = userMap.get(driverId) || {};

                return {
                    driverId,
                    email: userRow?.User_Email ?? userRow?.user_email ?? 'No email found',
                    name: driverRow?.Driver_Name ?? driverRow?.driver_name ?? userRow?.User_Name ?? userRow?.user_name ?? `Driver #${driverId}`,
                    points: membership?.User_Points ?? membership?.user_points ?? 0,
                    memberSince: membership?.Member_Since ?? membership?.member_since ?? null,
                    membershipStatus: membership?.Membership_Status ?? membership?.membership_status ?? 'Active',
                    sponsorId
                };
            }).filter((driver) => Number.isFinite(driver.driverId));

            listContainer.innerHTML = '';
            countPill.textContent = `${mergedDrivers.length} Drivers`;

            if (mergedDrivers.length === 0) {
                listContainer.innerHTML = `<p class="p-12 text-center text-slate-400 italic">No partnered drivers found.</p>`;
                return;
            }

            for (const driver of mergedDrivers) {
                const row = document.createElement('div');
                row.className = 'p-6 flex items-center justify-between hover:bg-slate-50 transition-colors gap-4';

                const memberSince = driver.memberSince
                    ? new Date(driver.memberSince).toLocaleDateString()
                    : '—';

                row.innerHTML = `
                    <div class="flex flex-col min-w-0">
                        <span class="font-bold text-slate-900 truncate">${escHtml(driver.email)}</span>
                        <span class="text-sm text-slate-600 truncate">${escHtml(driver.name)}</span>
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Driver ID: #${driver.driverId} · ${escHtml(driver.membershipStatus)} · Since ${escHtml(memberSince)}</span>
                    </div>

                    <div class="flex items-center gap-3 shrink-0">
                        <div class="text-right mr-2">
                            <span class="block text-[10px] text-slate-400 uppercase font-bold">Balance</span>
                            <span id="pts-${driver.driverId}" class="text-xl font-black text-slate-900">${escHtml(driver.points)} <span class="text-xs text-slate-400 font-medium">pts</span></span>
                        </div>

                        <button type="button"
                                class="adjust-btn bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all"
                                data-driver-id="${driver.driverId}"
                                data-driver-email="${escHtml(driver.email)}"
                                data-driver-name="${escHtml(driver.name)}"
                                data-sponsor-id="${driver.sponsorId}">
                            Adjust
                        </button>

                        <button type="button"
                                class="drop-btn bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-600 shadow-md active:scale-95 transition-all"
                                data-sponsor-id="${driver.sponsorId}"
                                data-driver-id="${driver.driverId}"
                                data-driver-email="${escHtml(driver.email)}">
                            Drop
                        </button>
                    </div>
                `;
                listContainer.appendChild(row);
            }

            listContainer.querySelectorAll('.adjust-btn').forEach((button) => {
                button.addEventListener('click', () => {
                    const driverId = Number(button.dataset.driverId);
                    const sponsorIdValue = Number(button.dataset.sponsorId);
                    const driverEmail = button.dataset.driverEmail || '';
                    const driverName = button.dataset.driverName || driverEmail;
                    window.adjustPoints(driverId, sponsorIdValue, driverEmail, driverName);
                });
            });

            listContainer.querySelectorAll('.drop-btn').forEach((button) => {
                button.addEventListener('click', () => {
                    const sponsorIdValue = Number(button.dataset.sponsorId);
                    const driverId = Number(button.dataset.driverId);
                    const driverEmail = button.dataset.driverEmail || `Driver #${driverId}`;
                    window.dropDriver(sponsorIdValue, driverId, driverEmail);
                });
            });
        } catch (error) {
            console.error(error);
            listContainer.innerHTML = `<p class="p-12 text-center text-red-500">Error: ${escHtml(getErrorMessage(error))}</p>`;
            countPill.textContent = '0 Drivers';
        }
    }

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
    const transactionsBody = document.getElementById('transactionsBody');
    const transactionsStatusEl = document.getElementById('transactionsStatus');
    const refreshTransactionsBtn = document.getElementById('refreshTransactionsBtn');

    let selectedDriverId = null;
    let selectedDriverEmail = null;
    let selectedSponsorId = null;
    let mode = 'add';

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

        const sorted = [...rows].sort((a, b) => {
            const da = new Date(a?.Created_At ?? a?.created_at ?? 0).getTime();
            const db = new Date(b?.Created_At ?? b?.created_at ?? 0).getTime();
            return db - da;
        });

        transactionsBody.innerHTML = sorted.slice(0, 15).map((t) => {
            const createdRaw = t?.Created_At ?? t?.created_at;
            const created = createdRaw ? new Date(createdRaw) : null;
            const dateStr = created && !Number.isNaN(created.getTime())
                ? created.toLocaleString()
                : escHtml(createdRaw || '');

            const sponsorName = t?.Sponsor_Name ?? t?.sponsor_name ?? '';
            const reason = t?.Reason_For_Change ?? t?.reason_for_change ?? '';
            const after = t?.Points_After_Change ?? t?.points_after_change ?? '';
            const changeRaw = t?.Points_Change ?? t?.points_change ?? '';
            const changeNum = typeof changeRaw === 'number' ? changeRaw : parseInt(changeRaw, 10);
            const isNeg = !Number.isNaN(changeNum) ? changeNum < 0 : String(changeRaw).trim().startsWith('-');

            const changeCell = `
                <span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${isNeg ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">
                    ${escHtml(changeRaw)}
                </span>
            `;

            return `
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 whitespace-nowrap text-slate-700">${escHtml(dateStr)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-slate-700">${escHtml(sponsorName)}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${changeCell}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-slate-700 font-semibold">${escHtml(after)}</td>
                    <td class="px-4 py-3 text-slate-700">${escHtml(reason)}</td>
                </tr>
            `;
        }).join('');
    }

    async function loadTransactions(driverId, sponsorId) {
        if (!driverId || !transactionsBody) return;

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
            const tx = await window.API.request(`/report/transaction/${driverId}?sponsor_id=${encodeURIComponent(sponsorId)}`);
            renderTxRows(Array.isArray(tx) ? tx : []);
            setTxStatus('');
        } catch (err) {
            const detail = String(err?.data?.detail || err?.message || '').toLowerCase();
            if (err?.status === 404 || detail.includes('no recent reports')) {
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
        selectedSponsorId = null;
        if (pointsAmountEl) pointsAmountEl.value = '';
        if (pointsReasonEl) pointsReasonEl.value = '';
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

    window.dropDriver = async (sponsorId, driverId, driverEmail) => {
        const reason = prompt(`Drop ${driverEmail} from your sponsor program?
Optional: enter a reason (or leave blank):`, '');
        if (reason === null) return;

        try {
            const qs = new URLSearchParams();
            qs.set('sponsor_id', sponsorId);
            qs.set('user_id', driverId);
            if (reason && reason.trim()) qs.set('drop_reason', reason.trim());

            await window.API.request(`/sponsors/drop_driver?${qs.toString()}`, { method: 'DELETE' });

            if (selectedDriverId === driverId) {
                editSection?.classList.add('hidden');
                selectedDriverId = null;
                selectedDriverEmail = null;
            }

            await loadDrivers();
        } catch (err) {
            console.error(err);
            alert(getErrorMessage(err, 'Could not drop driver.'));
        }
    };

    window.adjustPoints = async (driverId, sponsorId, email, displayName) => {
        selectedDriverId = driverId;
        selectedDriverEmail = email;
        selectedSponsorId = sponsorId;

        if (selectedDriverNameEl) selectedDriverNameEl.textContent = displayName || email;
        setMode('add');

        if (pointsAmountEl) pointsAmountEl.value = '';
        if (pointsReasonEl) pointsReasonEl.value = '';
        setStatus('');
        editSection?.classList.remove('hidden');

        try {
            const pts = await window.API.request(`/points/${driverId}?sponsor_id=${encodeURIComponent(sponsorId)}`);
            if (currentPointsEl) currentPointsEl.value = pts;
        } catch (err) {
            if (currentPointsEl) currentPointsEl.value = '';
            setStatus('Could not load current points for this driver.', 'error');
        }

        loadTransactions(driverId, sponsorId);
    };

    refreshTransactionsBtn?.addEventListener('click', () => {
        if (selectedDriverId && selectedSponsorId) {
            loadTransactions(selectedDriverId, selectedSponsorId);
        }
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
                    driver_id: selectedDriverId,
                    sponsor_id: selectedSponsorId,
                    points_change: signedChange,
                    reason: rawReason
                }
            });

            const newPoints = await window.API.request(`/points/${selectedDriverId}?sponsor_id=${encodeURIComponent(selectedSponsorId)}`);
            const ptDisplay = document.getElementById(`pts-${selectedDriverId}`);
            if (ptDisplay) {
                ptDisplay.innerHTML = `${escHtml(newPoints)} <span class="text-xs text-slate-400 font-medium">pts</span>`;
            }
            if (currentPointsEl) currentPointsEl.value = newPoints;

            const actionWord = signedChange < 0 ? 'deducted' : 'added';
            setStatus(`Points ${actionWord} (${Math.abs(signedChange)} pts). Reason: ${rawReason}`, 'success');

            loadTransactions(selectedDriverId, selectedSponsorId);
            if (pointsAmountEl) pointsAmountEl.value = '';
            if (pointsReasonEl) pointsReasonEl.value = '';
        } catch (err) {
            console.error(err);
            setStatus(getErrorMessage(err, 'Failed to update points.'), 'error');
        }
    });

    loadDrivers();
});