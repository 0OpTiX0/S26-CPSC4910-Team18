document.addEventListener('DOMContentLoaded', async () => {
    const session = JSON.parse(sessionStorage.getItem('gd_user') || 'null');

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const nameEl = document.getElementById('name');
    const emailEl = document.getElementById('email');
    const phoneEl = document.getElementById('phone');
    const passwordEl = document.getElementById('password');
    const statusEl = document.getElementById('status');
    const createBtn = document.getElementById('createBtn');

    function setStatus(msg, type = 'info') {
        statusEl.textContent = msg;
        statusEl.className =
            'text-sm text-center ' +
            (type === 'error'
                ? 'text-red-500'
                : type === 'success'
                ? 'text-green-600'
                : 'text-slate-500');
    }

    async function getMySponsor() {
        return window.API.request(
            `/sponsor-user/resolve?email=${encodeURIComponent(session.email)}`
        );
    }

    createBtn.addEventListener('click', async () => {
        const name = nameEl.value.trim();
        const email = emailEl.value.trim();
        const phone = phoneEl.value.trim();
        const password = passwordEl.value.trim();

        if (!name || !email || !phone || !password) {
            setStatus('All fields are required', 'error');
            return;
        }

        setStatus('Creating user...');

        try {
            const sponsor = await getMySponsor();

            const sponsorEmail =
                sponsor?.Sponsor_Email ||
                sponsor?.sponsor_email;

            if (!sponsorEmail) {
                throw new Error('Sponsor not found');
            }

            const payload = {
                name: name,
                email: email,
                phone: phone,
                pssw: password,
                role: "sponsor",
                sponsor_join: sponsorEmail,   
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            await window.API.request('/user', {
                method: 'POST',
                body: payload
            });

            setStatus('Sponsor user created successfully!', 'success');

            nameEl.value = '';
            emailEl.value = '';
            phoneEl.value = '';
            passwordEl.value = '';

        } catch (err) {
            console.error(err);

            const msg =
                err?.data?.detail ||
                err?.message ||
                'Failed to create user';

            setStatus(msg, 'error');
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('gd_user');
        window.location.href = 'login.html';
    });
});