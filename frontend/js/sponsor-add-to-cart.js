document.addEventListener('DOMContentLoaded', async () => {
    const session = JSON.parse(sessionStorage.getItem('gd_user') || 'null');

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const driverSelect = document.getElementById('driverSelect');
    const marketIdInput = document.getElementById('marketIdInput');
    const loadProductsBtn = document.getElementById('loadProductsBtn');
    const pageStatus = document.getElementById('pageStatus');
    const driverCount = document.getElementById('driverCount');
    const productCount = document.getElementById('productCount');
    const driverListContainer = document.getElementById('driverListContainer');
    const productListContainer = document.getElementById('productListContainer');
    const logoutBtn = document.getElementById('logoutBtn');

    let sponsor = null;
    let sponsorId = null;
    let sponsorEmail = null;
    let drivers = [];
    let products = [];

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
            return JSON.stringify(error.data.detail);
        }
        return error?.message || fallback;
    }

    function setPageStatus(message, kind = 'info') {
        pageStatus.textContent = message || '';
        pageStatus.className = 'mt-4 text-sm ' + (
            kind === 'error' ? 'text-rose-600' :
            kind === 'success' ? 'text-emerald-600' :
            'text-slate-500'
        );
    }

    async function getMySponsor() {
        return window.API.request(`/sponsor-user/resolve?email=${encodeURIComponent(session.email)}`);
    }

    async function loadDrivers() {
        driverListContainer.innerHTML = '<div class="p-12 text-center text-slate-400">Loading drivers...</div>';

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

        drivers = sponsorships.map((membership) => {
            const driverId = Number(
                membership?.Driver_User_ID ??
                membership?.driver_user_id ??
                membership?.Registered_Driver ??
                membership?.registered_driver
            );

            const driverRow = driverMap.get(driverId) || {};
            const userRow = userMap.get(driverId) || {};

            return {
                driverId,
                name: driverRow?.Driver_Name ?? driverRow?.driver_name ?? userRow?.User_Name ?? userRow?.user_name ?? `Driver #${driverId}`,
                email: userRow?.User_Email ?? userRow?.user_email ?? 'No email found',
                membershipStatus: membership?.Membership_Status ?? membership?.membership_status ?? 'Active',
                points: membership?.User_Points ?? membership?.user_points ?? 0
            };
        }).filter((driver) => Number.isFinite(driver.driverId));

        driverCount.textContent = `${drivers.length} Drivers`;

        driverSelect.innerHTML = '<option value="">Select a driver</option>' + drivers.map((driver) => `
            <option value="${driver.driverId}">
                ${escHtml(driver.name)} (${escHtml(driver.email)})
            </option>
        `).join('');

        if (drivers.length === 0) {
            driverListContainer.innerHTML = '<div class="p-12 text-center text-slate-400 italic">No subscribed drivers found.</div>';
            return;
        }

        driverListContainer.innerHTML = drivers.map((driver) => `
            <div class="p-6 flex items-center justify-between gap-4">
                <div class="min-w-0">
                    <div class="font-bold text-slate-900 truncate">${escHtml(driver.email)}</div>
                    <div class="text-sm text-slate-600 truncate">${escHtml(driver.name)}</div>
                    <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                        Driver ID: #${driver.driverId} · ${escHtml(driver.membershipStatus)} · ${escHtml(driver.points)} pts
                    </div>
                </div>
                <button type="button"
                    class="choose-driver-btn px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all"
                    data-driver-id="${driver.driverId}">
                    Choose
                </button>
            </div>
        `).join('');

        driverListContainer.querySelectorAll('.choose-driver-btn').forEach((button) => {
            button.addEventListener('click', () => {
                driverSelect.value = button.dataset.driverId || '';
                const chosenDriver = drivers.find((driver) => String(driver.driverId) === String(button.dataset.driverId));
                setPageStatus(chosenDriver
                    ? `Selected ${chosenDriver.name}. Enter your market ID and load products.`
                    : 'Driver selected. Enter your market ID and load products.');
            });
        });
    }

    async function loadProducts() {
        const marketId = parseInt((marketIdInput.value || '').trim(), 10);
        if (!marketId || marketId <= 0) {
            setPageStatus('Enter a valid market ID.', 'error');
            return;
        }

        productListContainer.innerHTML = '<div class="p-12 text-center text-slate-400">Loading products...</div>';
        setPageStatus('Loading market products...');

        try {
            const productsRaw = await window.API.request(`/products/${encodeURIComponent(marketId)}`);
            products = Array.isArray(productsRaw) ? productsRaw : [];
            productCount.textContent = `${products.length} Products`;

            if (products.length === 0) {
                productListContainer.innerHTML = '<div class="p-12 text-center text-slate-400 italic">No products found in this market.</div>';
                setPageStatus('No products found for that market.', 'error');
                return;
            }

            productListContainer.innerHTML = products.map((product) => {
                const productId = product?.ProductID ?? product?.product_id;
                const name = product?.Product_Name ?? product?.product_name ?? `Product #${productId}`;
                const description = product?.Product_Description ?? product?.product_description ?? '';
                const price = product?.Product_Price ?? product?.product_price ?? 0;
                const qty = product?.Product_Qty ?? product?.product_qty ?? 0;
                const image = product?.Product_Image ?? product?.product_image ?? '';

                return `
                    <div class="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div class="flex items-start gap-4 min-w-0">
                            <img src="${escHtml(image || 'https://placehold.co/96x96?text=Item')}"
                                 alt="${escHtml(name)}"
                                 class="w-24 h-24 rounded-2xl object-cover border border-slate-200 shrink-0">
                            <div class="min-w-0">
                                <div class="font-bold text-slate-900">${escHtml(name)}</div>
                                <div class="text-sm text-slate-600 mt-1">${escHtml(description)}</div>
                                <div class="text-[11px] text-slate-400 uppercase font-bold tracking-widest mt-2">
                                    Product ID: #${productId} · ${escHtml(price)} pts · Stock ${escHtml(qty)}
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-3 shrink-0">
                            <input type="number"
                                   min="1"
                                   step="1"
                                   value="1"
                                   class="qty-input w-24 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                   data-product-id="${productId}">
                            <button type="button"
                                class="add-to-cart-btn px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-md active:scale-95 transition-all"
                                data-product-id="${productId}">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            productListContainer.querySelectorAll('.add-to-cart-btn').forEach((button) => {
                button.addEventListener('click', async () => {
                    const driverId = parseInt(driverSelect.value, 10);
                    const productId = parseInt(button.dataset.productId || '', 10);
                    const qtyInput = productListContainer.querySelector(`.qty-input[data-product-id="${productId}"]`);
                    const qty = parseInt(qtyInput?.value || '', 10);

                    if (!driverId) {
                        setPageStatus('Choose a driver before adding items.', 'error');
                        return;
                    }

                    if (!productId || !qty || qty <= 0) {
                        setPageStatus('Enter a valid quantity.', 'error');
                        return;
                    }

                    const originalText = button.textContent;
                    button.disabled = true;
                    button.textContent = 'Adding...';
                    button.classList.add('scale-95', 'opacity-80');
                    button.classList.remove('hover:bg-emerald-700');

                    try {
                        await addItemToDriverCart(driverId, productId, qty, button, originalText);
                    } finally {
                        button.disabled = false;
                    }
                });
            });

            setPageStatus('Products loaded.');
        } catch (error) {
            console.error(error);
            productListContainer.innerHTML = `<div class="p-12 text-center text-rose-500">${escHtml(getErrorMessage(error))}</div>`;
            productCount.textContent = '0 Products';
            setPageStatus(getErrorMessage(error, 'Could not load products.'), 'error');
        }
    }

    async function addItemToDriverCart(driverId, productId, qty, button, originalText) {
        try {
            setPageStatus('Preparing cart...');

            const cart = await window.API.request(`/cart/${encodeURIComponent(driverId)}`, {
                method: 'POST'
            });

            const cartId = cart?.CartID ?? cart?.cart_id;
            if (!cartId) {
                throw new Error('Cart was created but no cart ID was returned.');
            }

            await window.API.request(
                `/cart/cart_item/${encodeURIComponent(cartId)}?prod_id=${encodeURIComponent(productId)}&prod_qty=${encodeURIComponent(qty)}`,
                { method: 'POST' }
            );

            try {
                await window.API.request(`/cart/${encodeURIComponent(cartId)}`, { method: 'PATCH' });
            } catch (e) {
                console.warn('Cart total recalculation failed:', e);
            }

            const driver = drivers.find((item) => item.driverId === driverId);
            const driverName = driver?.name || `Driver #${driverId}`;

            button.textContent = 'Added!';
            button.classList.remove('bg-emerald-600', 'scale-95', 'opacity-80');
            button.classList.add('bg-emerald-700');

            setPageStatus(`Added item to ${driverName}'s cart successfully.`, 'success');

            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('bg-emerald-700');
                button.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
            }, 900);
        } catch (error) {
            console.error(error);
            button.textContent = originalText;
            button.classList.remove('scale-95', 'opacity-80');
            button.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
            setPageStatus(getErrorMessage(error, 'Could not add item to cart.'), 'error');
        }
    }

    loadProductsBtn?.addEventListener('click', loadProducts);

    logoutBtn?.addEventListener('click', () => {
        sessionStorage.removeItem('gd_user');
        window.location.href = 'login.html';
    });

    try {
        sponsor = await getMySponsor();
        sponsorId = sponsor?.Sponsor_ID ?? sponsor?.sponsor_id;
        sponsorEmail = sponsor?.Sponsor_Email ?? sponsor?.sponsor_email ?? session.email;

        if (!sponsorId || !sponsorEmail) {
            throw new Error('Sponsor account is not linked to a sponsor record.');
        }

        await loadDrivers();
        setPageStatus('Choose a driver, then enter your market ID to load products.');
    } catch (error) {
        console.error(error);
        setPageStatus(getErrorMessage(error, 'Could not initialize sponsor cart tools.'), 'error');
        driverListContainer.innerHTML = '<div class="p-12 text-center text-rose-500">Could not load sponsor drivers.</div>';
    }
});