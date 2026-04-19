document.addEventListener('DOMContentLoaded', async () => {
    const session = JSON.parse(
        sessionStorage.getItem('gd_user') ||
        localStorage.getItem('gd_user') ||
        'null'
    );

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const role = String(session.role || '').toLowerCase();
    if (!role.includes('admin')) {
        alert('Only admin users can access this page.');
        window.location.href = 'index.html';
        return;
    }

    const usersBody = document.getElementById('admin-users-body');
    const usersEmpty = document.getElementById('admin-users-empty');
    const usersCount = document.getElementById('admin-users-count');
    const searchInput = document.getElementById('admin-user-search');
    const roleFilter = document.getElementById('admin-role-filter');
    const refreshUsersBtn = document.getElementById('refresh-users');

    const toggleCreateUserBtn = document.getElementById('toggle-create-user');
    const createUserPanel = document.getElementById('create-user-panel');
    const createUserForm = document.getElementById('create-user-form');
    const createUserMsg = document.getElementById('create-user-msg');
    const createUserClearBtn = document.getElementById('create-user-clear');

    const cuName = document.getElementById('cu-name');
    const cuRole = document.getElementById('cu-role');
    const cuEmail = document.getElementById('cu-email');
    const cuPhone = document.getElementById('cu-phone');
    const cuPassword = document.getElementById('cu-password');
    const cuSponsorJoinWrap = document.getElementById('cu-sponsor-join-wrap');
    const cuSponsorJoin = document.getElementById('cu-sponsor-join');

    const toggleSponsorOrgBtn = document.getElementById('toggle-sponsor-org');
    const sponsorOrgPanel = document.getElementById('sponsor-org-panel');
    const sponsorOrgForm = document.getElementById('create-sponsor-org-form');
    const sponsorOrgMsg = document.getElementById('so-msg');
    const sponsorOrgClearBtn = document.getElementById('so-clear');

    const soName = document.getElementById('so-name');
    const soEmail = document.getElementById('so-email');
    const soPhone = document.getElementById('so-phone');
    const soDescription = document.getElementById('so-description');

    let allUsers = [];
    let expandedUserId = null;

    const escHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char] || char));

    function setMessage(el, text, kind = 'info') {
        if (!el) return;
        el.textContent = text || '';
        el.className = 'text-sm font-semibold ' + (
            kind === 'error' ? 'text-rose-600' :
            kind === 'success' ? 'text-emerald-600' :
            'text-slate-600'
        );
        if (text) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    function getErrorMessage(error, fallback = 'API request failed') {
        if (error?.data?.detail) {
            if (Array.isArray(error.data.detail)) {
                return error.data.detail.map((item) => item?.msg || JSON.stringify(item)).join(', ');
            }
            if (typeof error.data.detail === 'string') {
                return error.data.detail;
            }
            return JSON.stringify(error.data.detail);
        }
        return error?.message || fallback;
    }

    function roleBadgeClass(userRole) {
        const normalized = String(userRole || '').toLowerCase();
        if (normalized.includes('admin')) return 'bg-violet-100 text-violet-700';
        if (normalized.includes('sponsor')) return 'bg-blue-100 text-blue-700';
        if (normalized.includes('driver')) return 'bg-emerald-100 text-emerald-700';
        return 'bg-slate-100 text-slate-700';
    }

    function formatRole(userRole) {
        const normalized = String(userRole || '').toLowerCase();
        if (!normalized) return 'Unknown';
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    function showSponsorJoinIfNeeded() {
        const value = String(cuRole.value || '').toLowerCase();
        if (value === 'driver' || value === 'sponsor') {
            cuSponsorJoinWrap.classList.remove('hidden');
        } else {
            cuSponsorJoinWrap.classList.add('hidden');
            cuSponsorJoin.value = '';
        }
    }

    function clearCreateUserForm() {
        createUserForm.reset();
        cuRole.value = 'driver';
        showSponsorJoinIfNeeded();
        setMessage(createUserMsg, '');
    }

    function clearSponsorOrgForm() {
        sponsorOrgForm.reset();
        setMessage(sponsorOrgMsg, '');
    }

    function buildUserQuery() {
        const params = new URLSearchParams();
        const search = String(searchInput.value || '').trim();
        const role = String(roleFilter.value || '').trim();

        if (role) {
            params.set('userRole', role);
        }

        if (search) {
            params.set('userName', search);
            params.set('userEmail', search);
            params.set('userPhoneNum', search);
        }

        const qs = params.toString();
        return `/user${qs ? `?${qs}` : ''}`;
    }

    async function loadUsers() {
        try {
            usersBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-10 text-center text-slate-500">
                        <span class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent align-[-4px]"></span>
                        <span class="ml-2">Loading users...</span>
                    </td>
                </tr>
            `;
            usersEmpty.classList.add('hidden');

            const result = await window.API.request(buildUserQuery());
            allUsers = Array.isArray(result) ? result : [];
            renderUsers();
        } catch (error) {
            console.error(error);
            usersBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-10 text-center text-rose-600 font-semibold">
                        ${escHtml(getErrorMessage(error, 'Could not load users.'))}
                    </td>
                </tr>
            `;
            usersCount.textContent = '0 Users';
            usersEmpty.classList.add('hidden');
        }
    }

    function renderUsers() {
        usersCount.textContent = `${allUsers.length} User${allUsers.length === 1 ? '' : 's'}`;

        if (!allUsers.length) {
            usersBody.innerHTML = '';
            usersEmpty.classList.remove('hidden');
            return;
        }

        usersEmpty.classList.add('hidden');
        usersBody.innerHTML = allUsers.map((user) => {
            const userId = user?.UserID ?? user?.user_id ?? '';
            const name = user?.User_Name ?? user?.user_name ?? 'Unknown User';
            const email = user?.User_Email ?? user?.user_email ?? 'No email';
            const phone = user?.User_Phone_Num ?? user?.user_phone_num ?? '—';
            const userRole = user?.User_Role ?? user?.user_role ?? 'unknown';

            return `
                <tr class="hover:bg-slate-50 transition cursor-pointer user-row" data-user-id="${escHtml(userId)}">
                    <td class="px-6 py-4 font-semibold text-slate-900">#${escHtml(userId)}</td>
                    <td class="px-6 py-4">
                        <div class="font-bold text-slate-900">${escHtml(name)}</div>
                        <div class="text-xs text-slate-500 mt-1">${escHtml(email)}</div>
                    </td>
                    <td class="px-6 py-4 text-slate-700">${escHtml(phone)}</td>
                    <td class="px-6 py-4">
                        <span class="inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${roleBadgeClass(userRole)}">
                            ${escHtml(formatRole(userRole))}
                        </span>
                    </td>
                </tr>
                <tr id="detail-row-${escHtml(userId)}" class="hidden">
                    <td colspan="4" class="px-6 pb-6 pt-0 bg-slate-50/70">
                        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-center justify-between gap-4 mb-4">
                                <div>
                                    <h3 class="font-bold text-slate-900">Manage User #${escHtml(userId)}</h3>
                                    <p class="text-xs text-slate-500">Review, update, disable, enable, or remove this account.</p>
                                </div>
                                <button type="button"
                                        class="collapse-user-detail px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold hover:bg-slate-50 transition"
                                        data-user-id="${escHtml(userId)}">
                                    Close
                                </button>
                            </div>

                            <form class="user-edit-form grid grid-cols-1 md:grid-cols-2 gap-4" data-user-id="${escHtml(userId)}">
                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold text-slate-700 uppercase">Full Name</label>
                                    <input type="text" name="name"
                                           class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                           value="${escHtml(name)}" required>
                                </div>

                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold text-slate-700 uppercase">Role</label>
                                    <input type="text" disabled
                                           class="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm"
                                           value="${escHtml(formatRole(userRole))}">
                                </div>

                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold text-slate-700 uppercase">Email</label>
                                    <input type="email" name="email"
                                           class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                           value="${escHtml(email)}" required>
                                </div>

                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold text-slate-700 uppercase">Phone</label>
                                    <input type="tel" name="phone"
                                           class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                           value="${escHtml(phone)}" required>
                                </div>

                                <div class="space-y-1 md:col-span-2">
                                    <label class="text-[10px] font-bold text-slate-700 uppercase">Timezone</label>
                                    <input type="text" name="timezone"
                                           class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                           placeholder="America/New_York">
                                </div>

                                <div class="space-y-1 md:col-span-2">
                                    <label class="text-[10px] font-bold text-slate-700 uppercase">Admin Action Reason</label>
                                    <textarea name="reason"
                                              class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                              rows="3"
                                              placeholder="Optional reason for disable / enable / delete"></textarea>
                                </div>

                                <div class="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
                                    <div class="user-detail-msg hidden text-sm font-semibold"></div>
                                    <div class="flex flex-wrap gap-3">
                                        <button type="submit"
                                                class="px-4 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold border-2 border-slate-300 shadow hover:bg-slate-50 transition">
                                            Save Changes
                                        </button>
                                        <button type="button"
                                                class="disable-user-btn px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
                                                data-user-id="${escHtml(userId)}">
                                            Disable
                                        </button>
                                        <button type="button"
                                                class="enable-user-btn px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                                                data-user-id="${escHtml(userId)}">
                                            Enable
                                        </button>
                                        <button type="button"
                                                class="delete-user-btn px-4 py-2 rounded-xl border border-rose-300 text-rose-700 bg-white text-xs font-bold hover:bg-rose-50 transition"
                                                data-user-id="${escHtml(userId)}">
                                            Delete User
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        bindUserRowEvents();
    }

    function bindUserRowEvents() {
        usersBody.querySelectorAll('.user-row').forEach((row) => {
            row.addEventListener('click', async (event) => {
                if (event.target.closest('button')) return;
                const userId = Number(row.dataset.userId);
                await toggleUserDetail(userId);
            });
        });

        usersBody.querySelectorAll('.collapse-user-detail').forEach((button) => {
            button.addEventListener('click', () => {
                const userId = Number(button.dataset.userId);
                const detailRow = document.getElementById(`detail-row-${userId}`);
                if (detailRow) detailRow.classList.add('hidden');
                expandedUserId = expandedUserId === userId ? null : expandedUserId;
            });
        });

        usersBody.querySelectorAll('.user-edit-form').forEach((form) => {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const userId = Number(form.dataset.userId);
                await saveUserEdits(userId, form);
            });
        });

        usersBody.querySelectorAll('.disable-user-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const userId = Number(button.dataset.userId);
                const form = button.closest('.user-edit-form');
                await updateAccountStatus(userId, true, form);
            });
        });

        usersBody.querySelectorAll('.enable-user-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const userId = Number(button.dataset.userId);
                const form = button.closest('.user-edit-form');
                await updateAccountStatus(userId, false, form);
            });
        });

        usersBody.querySelectorAll('.delete-user-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const userId = Number(button.dataset.userId);
                const confirmed = window.confirm(`Delete user #${userId}? This cannot be undone.`);
                if (!confirmed) return;
                await deleteUser(userId);
            });
        });
    }

    async function toggleUserDetail(userId) {
        const detailRow = document.getElementById(`detail-row-${userId}`);
        if (!detailRow) return;

        usersBody.querySelectorAll('[id^="detail-row-"]').forEach((row) => {
            if (row.id !== `detail-row-${userId}`) row.classList.add('hidden');
        });

        const shouldOpen = detailRow.classList.contains('hidden');
        if (!shouldOpen) {
            detailRow.classList.add('hidden');
            expandedUserId = null;
            return;
        }

        detailRow.classList.remove('hidden');
        expandedUserId = userId;

        try {
            const profile = await window.API.request(`/account/${userId}`);
            hydrateDetailForm(userId, profile);
        } catch (error) {
            console.error(error);
            const form = detailRow.querySelector('.user-edit-form');
            const msg = detailRow.querySelector('.user-detail-msg');
            if (form) {
                Array.from(form.elements).forEach((el) => {
                    if (el.name === 'timezone') return;
                });
            }
            setMessage(msg, getErrorMessage(error, 'Could not load account details.'), 'error');
        }
    }

    function hydrateDetailForm(userId, profile) {
        const detailRow = document.getElementById(`detail-row-${userId}`);
        if (!detailRow) return;

        const form = detailRow.querySelector('.user-edit-form');
        if (!form) return;

        const nameInput = form.querySelector('[name="name"]');
        const emailInput = form.querySelector('[name="email"]');
        const phoneInput = form.querySelector('[name="phone"]');
        const timezoneInput = form.querySelector('[name="timezone"]');
        const msg = detailRow.querySelector('.user-detail-msg');

        if (nameInput) nameInput.value = profile?.name ?? '';
        if (emailInput) emailInput.value = profile?.email ?? '';
        if (phoneInput) phoneInput.value = profile?.phone ?? '';
        if (timezoneInput) timezoneInput.value = profile?.timezone ?? '';
        setMessage(msg, '');
    }

    async function saveUserEdits(userId, form) {
        const msg = form.querySelector('.user-detail-msg');
        try {
            setMessage(msg, 'Saving changes...', 'info');

            const body = {
                name: form.querySelector('[name="name"]')?.value.trim(),
                email: form.querySelector('[name="email"]')?.value.trim(),
                phone: form.querySelector('[name="phone"]')?.value.trim(),
                timezone: form.querySelector('[name="timezone"]')?.value.trim()
            };

            await window.API.request(`/account/${userId}`, {
                method: 'PATCH',
                body
            });

            setMessage(msg, 'User updated successfully.', 'success');
            await loadUsers();
            if (expandedUserId === userId) {
                setTimeout(() => toggleUserDetail(userId), 0);
            }
        } catch (error) {
            console.error(error);
            setMessage(msg, getErrorMessage(error, 'Could not update user.'), 'error');
        }
    }

    async function updateAccountStatus(userId, disabled, form) {
        const msg = form.querySelector('.user-detail-msg');
        const reason = form.querySelector('[name="reason"]')?.value.trim() || undefined;

        try {
            setMessage(msg, disabled ? 'Disabling user...' : 'Enabling user...', 'info');

            await window.API.request(`/admin/account_status/${userId}`, {
                method: 'PATCH',
                body: {
                    disabled,
                    reason
                }
            });

            setMessage(msg, disabled ? 'User disabled successfully.' : 'User enabled successfully.', 'success');
            await loadUsers();
            if (expandedUserId === userId) {
                setTimeout(() => toggleUserDetail(userId), 0);
            }
        } catch (error) {
            console.error(error);
            setMessage(msg, getErrorMessage(error, 'Could not update account status.'), 'error');
        }
    }

    async function deleteUser(userId) {
        try {
            await window.API.request(`/user/${userId}`, { method: 'DELETE' });
            await loadUsers();
        } catch (error) {
            console.error(error);
            alert(getErrorMessage(error, 'Could not delete user.'));
        }
    }

    async function createUser(event) {
        event.preventDefault();

        try {
            setMessage(createUserMsg, 'Creating user...', 'info');

            const payload = {
                name: cuName.value.trim(),
                role: cuRole.value.trim().toLowerCase(),
                email: cuEmail.value.trim(),
                phone: cuPhone.value.trim(),
                pssw: cuPassword.value,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
            };

            const sponsorJoinValue = cuSponsorJoin.value.trim();
            if (sponsorJoinValue) {
                payload.sponsor_join = sponsorJoinValue;
            }

            await window.API.request('/user', {
                method: 'POST',
                body: payload
            });

            setMessage(createUserMsg, 'User created successfully.', 'success');
            clearCreateUserForm();
            await loadUsers();
        } catch (error) {
            console.error(error);
            setMessage(createUserMsg, getErrorMessage(error, 'Could not create user.'), 'error');
        }
    }

    async function createSponsorOrg(event) {
        event.preventDefault();

        try {
            setMessage(sponsorOrgMsg, 'Creating sponsor organization...', 'info');

            await window.API.request('/sponsor', {
                method: 'POST',
                body: {
                    name: soName.value.trim(),
                    email: soEmail.value.trim(),
                    phone: soPhone.value.trim(),
                    description: soDescription.value.trim()
                }
            });

            setMessage(sponsorOrgMsg, 'Sponsor organization created successfully.', 'success');
            clearSponsorOrgForm();
        } catch (error) {
            console.error(error);
            setMessage(sponsorOrgMsg, getErrorMessage(error, 'Could not create sponsor organization.'), 'error');
        }
    }

    toggleCreateUserBtn?.addEventListener('click', () => {
        createUserPanel.classList.toggle('hidden');
    });

    toggleSponsorOrgBtn?.addEventListener('click', () => {
        sponsorOrgPanel.classList.toggle('hidden');
    });

    cuRole?.addEventListener('change', showSponsorJoinIfNeeded);
    createUserClearBtn?.addEventListener('click', clearCreateUserForm);
    sponsorOrgClearBtn?.addEventListener('click', clearSponsorOrgForm);

    createUserForm?.addEventListener('submit', createUser);
    sponsorOrgForm?.addEventListener('submit', createSponsorOrg);

    searchInput?.addEventListener('input', loadUsers);
    roleFilter?.addEventListener('change', loadUsers);
    refreshUsersBtn?.addEventListener('click', loadUsers);

    showSponsorJoinIfNeeded();
    await loadUsers();
});