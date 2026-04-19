document.addEventListener('DOMContentLoaded', async () => {
    const cartContainer = document.getElementById('cart-items-list');
    const summaryBox = document.getElementById('order-summary');
    const emptySummary = document.getElementById('empty-summary');
    const totalDisplay = document.getElementById('total-cost');
    const subtotalDisplay = document.getElementById('subtotal-cost');
    const balanceStatus = document.getElementById('balance-status');
    const checkoutBtn = document.getElementById('checkout-btn');
    const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user") || 'null');
    const effectiveRole = window.GDUserView?.getEffectiveRole(session) || String(session?.role || '').toLowerCase();
    const driverPreview = !!window.GDUserView?.isDriverViewActive?.(session);
    const itemCountPill = document.getElementById('cart-item-count');
    const pointsDisplay = document.getElementById('display-points');


    if (!session) { window.location.href = "login.html"; return; }
    if (effectiveRole !== 'driver') {
        window.location.href = "index.html";
        return;
    }

    let currentBalance = 0;
    let currentSponsorId = null;
    let currentMarketId = null;
    let activeCartId = null;

    const escHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char] || char));

    function formatPoints(value) {
        const num = Number(value) || 0;
        return `${num} pts`;
    }

    function getPointsStorageKey() {
        return `gd_points_balance_${session.userId}_${currentSponsorId}`;
    }

    function getStoredBalance() {
        const raw = localStorage.getItem(getPointsStorageKey());
        return raw === null ? null : Number(raw);
    }

    function setStoredBalance(value) {
        localStorage.setItem(getPointsStorageKey(), String(Number(value) || 0));
    }

    function setCheckoutState(enabled, label) {
        checkoutBtn.disabled = !enabled;

        if (enabled) {
            checkoutBtn.textContent = label || 'Redeem Points';
            checkoutBtn.className = 'w-full mt-2 bg-slate-900 text-white py-4 rounded-2xl font-black tracking-wide hover:bg-blue-600 transition-all active:scale-[0.99] shadow-lg shadow-slate-900/10';
        } else {
            checkoutBtn.textContent = label || 'Insufficient Points';
            checkoutBtn.className = 'w-full mt-2 bg-slate-200 text-slate-500 py-4 rounded-2xl font-black tracking-wide cursor-not-allowed';
        }
    }

    async function initializeContext() {
        try {
            const ctx = await window.GDDriverSponsors?.ensureActiveSponsor?.(session);
            currentSponsorId = ctx?.activeSponsor?.id || null;
            currentMarketId = window.GDDriverSponsors?.getSavedMarketIdForSponsor?.(currentSponsorId) || null;
            return true;
        } catch (error) {
            console.error("Failed to load context:", error);
            return false;
        }
    }

    function showBanner(message, kind = 'slate') {
        const existing = document.getElementById('cart-context-banner');
        if (existing) existing.remove();
        const banner = document.createElement('div');
        banner.id = 'cart-context-banner';
        banner.className = `mb-5 rounded-2xl border px-5 py-4 text-sm ${kind === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`;
        banner.innerHTML = message;
        cartContainer.before(banner);
    }

    async function loadCart() {
        try {
            const pending = await window.API.request(`/cart/${session.userId}?status=Pending`);
            const items = Array.isArray(pending) ? pending : [];

            if (items.length > 0) {
                const cartSponsorId = Number(items[0]?.sponsor_id || 0);
                const cartMarketId = Number(items[0]?.market_id || 0);
                if (cartSponsorId) {
                    currentSponsorId = cartSponsorId;
                    window.GDDriverSponsors?.setActiveSponsorId?.(cartSponsorId, { silent: true });
                }
                if (cartMarketId) {
                    currentMarketId = cartMarketId;
                }
            }

            if (!currentSponsorId) {
                console.error('CRITICAL: currentSponsorId is null. Cannot fetch points.');
                showEmptyCart();
                return;
            }

            const cacheBuster = Date.now();
            const backendBalance = await window.API.request(`/points/${session.userId}?sponsor_id=${currentSponsorId}&_t=${cacheBuster}`);
            const storedBalance = getStoredBalance();

            currentBalance = Number(backendBalance || 0);
            setStoredBalance(currentBalance);

            if (pointsDisplay) {
                pointsDisplay.textContent = formatPoints(currentBalance);
            }

            if (!items.length) {
                showEmptyCart();
                return;
            }

            activeCartId = items[0]?.CartID || items[0]?.cart_id || null;

            cartContainer.innerHTML = '';
            if (driverPreview) {
                showBanner('<strong>Preview cart:</strong> sponsor users can review the cart flow here, but checkout is disabled in Driver View.', 'amber');
            } else {
                const cachedSponsors = window.GDDriverSponsors?.getCachedSponsors?.() || [];
                const sponsor = cachedSponsors.find((item) => Number(item.id) === Number(currentSponsorId));
                if (sponsor) {
                    showBanner(`This pending cart is currently using <strong>${sponsor.name}</strong>. Switching sponsors in the store will not move these items.`);
                }
            }

            let total = 0;
            items.forEach(item => {
                const itemName = item.product_name || item.Product_Name || "Unknown Item";
                const itemPrice = parseInt(item.price || item.Prod_Price || 0, 10);
                const itemQty = parseInt(item.qty || item.Prod_Qty || 1, 10);
                const itemId = item.Cart_Item_ID || item.cart_item_id || item.CartItemID || item.id;
                total += (itemPrice * itemQty);

                const itemRow = document.createElement('div');
                itemRow.className = "bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm";
                itemRow.innerHTML = `
                    <div class="pr-4">
                        <h3 class="font-bold text-slate-900">${itemName}</h3>
                        <p class="text-xs text-slate-400 uppercase font-bold mt-1">Item #${itemId} <span class="text-blue-400 px-2">•</span> Qty: ${itemQty}</p>
                    </div>
                    <div class="flex items-center gap-6 shrink-0">
                        <span class="font-black text-blue-600 text-lg">${itemPrice * itemQty} pts</span>
                        <button onclick="removeItem(${activeCartId}, ${itemId})" class="h-8 w-8 rounded-full bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-500 font-bold transition-colors flex items-center justify-center">✕</button>
                    </div>
                `;
                cartContainer.appendChild(itemRow);
            });
            subtotalDisplay.textContent = `${total} pts`;
            totalDisplay.textContent = `${total} pts`;
            summaryBox.classList.remove('hidden');
            
            if (driverPreview) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = "Preview Only";
                checkoutBtn.className = "w-full bg-amber-100 text-amber-700 py-4 rounded-2xl font-black cursor-not-allowed";
            } else if (currentBalance < total) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = "Insufficient Points";
                checkoutBtn.className = "w-full bg-slate-700 text-slate-500 py-4 rounded-2xl font-black cursor-not-allowed";
            } else {
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = "Place Order";
                checkoutBtn.className = "w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-blue-600 transition-colors";
            }
        } catch (err) {
            console.error('Failed to load cart context:', err);
            showEmptyCart();
        }
    }

    function showEmptyCart() {
        const existing = document.getElementById('cart-context-banner');
        if (existing) existing.remove();

        if (itemCountPill) itemCountPill.textContent = '0 Items';

        cartContainer.innerHTML = `
            <div class="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <p class="text-slate-400 font-medium italic">Your cart is empty.</p>
            </div>
        `;

        summaryBox.classList.add('hidden');
        if (emptySummary) emptySummary.classList.remove('hidden');
        activeCartId = null;
    }

    checkoutBtn.addEventListener('click', async () => {
        const confirmed = confirm('Redeem your points to place this rewards order?');
        if (!confirmed) return;

        try {
            setCheckoutState(false, 'Processing...');

            await window.API.request("/products/purchase", {
                method: "PATCH",
                body: {
                    market_id: parseInt(currentMarketId),
                    product_id: 0,
                    driver_id: session.userId
                }
            });

            alert("Order successful! Your rewards are on the way.");
            window.location.href = "store_catalog.html";
        } catch (err) {
            console.error(err);
            showNotification('Order Failed');
        }
    });

    function showNotification(message, isError = false) {
        const notif = document.createElement('div');

        notif.className = `
            fixed top-6 right-6 z-50
            ${isError ? 'bg-red-600' : 'bg-emerald-600'} text-white
            px-6 py-4 rounded-2xl
            shadow-xl font-bold
        `;

        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.classList.add('opacity-0', 'transition', 'duration-500');
            setTimeout(() => notif.remove(), 500);
        }, 2500);
    }

    window.removeItem = async (cartId, cartItemId) => {
        try {
            await window.API.request(`/cart/${session.userId}/${cartItemId}`, {
                method: 'DELETE'
            });

            await loadCart();
        } catch (error) {
            console.error('Failed to remove item', error);
            alert('Could not remove item from cart.');
        }
    };

    window.addEventListener('gd:active-sponsor-changed', async () => {
        await initializeContext();
        loadCart();
    });

    const hasContext = await initializeContext();
    if (hasContext) {
        loadCart();
    }
});
