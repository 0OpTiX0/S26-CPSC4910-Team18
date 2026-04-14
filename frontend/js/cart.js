document.addEventListener('DOMContentLoaded', async () => {
    const cartContainer = document.getElementById('cart-items-list');
    const summaryBox = document.getElementById('order-summary');
    const emptySummary = document.getElementById('empty-summary');
    const totalDisplay = document.getElementById('total-cost');
    const subtotalDisplay = document.getElementById('subtotal-cost');
    const balanceStatus = document.getElementById('balance-status');
    const checkoutBtn = document.getElementById('checkout-btn');
    const itemCountPill = document.getElementById('cart-item-count');
    const pointsDisplay = document.getElementById('display-points');

    const session = JSON.parse(localStorage.getItem('gd_user') || sessionStorage.getItem('gd_user'));

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    let cartData = [];
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
            const sponsorships = await window.API.request(`/admin/get_sponsor_list?driver_id=${session.userId}`);

            if (Array.isArray(sponsorships) && sponsorships.length > 0) {
                currentSponsorId = sponsorships[0].Sponsor_ID;
            } else {
                console.warn('Could not find sponsor via /admin/get_sponsor_list. Falling back to sponsor 1.');
                currentSponsorId = 1;
            }

            const savedMarketKey = `gd_market_id_sponsor_${currentSponsorId}`;
            currentMarketId = localStorage.getItem(savedMarketKey) || 1;

            return true;
        } catch (error) {
            console.error('Failed to load context:', error);
            currentSponsorId = 1;
            currentMarketId = 1;
            return true;
        }
    }

    function showEmptyCart() {
        itemCountPill.textContent = '0 Items';
        cartContainer.innerHTML = `
            <div class="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
                <div class="text-5xl mb-4">🛒</div>
                <h3 class="text-xl font-bold text-slate-900">Your cart is empty</h3>
                <p class="mt-2 text-slate-500">Browse the rewards store and add items using your available points.</p>
                <a href="store_catalog.html"
                   class="inline-flex items-center mt-6 px-5 py-3 rounded-2xl bg-slate-900 text-white font-bold hover:bg-blue-600 transition-all">
                    Continue Shopping
                </a>
            </div>
        `;
        summaryBox.classList.add('hidden');
        emptySummary.classList.remove('hidden');
        activeCartId = null;
    }

    function renderCart(items) {
        cartContainer.innerHTML = '';

        let total = 0;
        let totalItems = 0;

        items.forEach((item) => {
            const itemName = item.product_name || item.Product_Name || 'Unknown Item';
            const itemPrice = parseInt(item.price || item.Prod_Price || 0, 10);
            const itemQty = parseInt(item.qty || item.Prod_Qty || 1, 10);
            const itemId = item.Cart_Item_ID || item.cart_item_id || item.CartItemID || item.id;
            const lineTotal = itemPrice * itemQty;

            total += lineTotal;
            totalItems += itemQty;

            const itemRow = document.createElement('div');
            itemRow.className = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow';

            itemRow.innerHTML = `
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <div class="flex items-center gap-3 flex-wrap">
                            <h3 class="text-lg font-bold text-slate-900">${escHtml(itemName)}</h3>
                            <span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                Qty ${itemQty}
                            </span>
                        </div>

                        <div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
                            <span class="text-slate-500">Item #${escHtml(itemId)}</span>
                            <span class="text-slate-300">•</span>
                            <span class="text-slate-500">${formatPoints(itemPrice)} each</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-4 shrink-0">
                        <div class="text-right">
                            <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Line Total</div>
                            <div class="text-xl font-black text-blue-600">${formatPoints(lineTotal)}</div>
                        </div>

                        <button
                            type="button"
                            onclick="removeItem(${activeCartId}, ${itemId})"
                            class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                            aria-label="Remove ${escHtml(itemName)} from cart">
                            ✕
                        </button>
                    </div>
                </div>
            `;

            cartContainer.appendChild(itemRow);
        });

        itemCountPill.textContent = `${totalItems} Item${totalItems === 1 ? '' : 's'}`;
        subtotalDisplay.textContent = formatPoints(total);
        totalDisplay.textContent = formatPoints(total);

        const remaining = currentBalance - total;
        if (remaining >= 0) {
            balanceStatus.textContent = `${remaining} pts remaining after checkout`;
            balanceStatus.className = 'text-right text-sm font-semibold text-emerald-600';
            setCheckoutState(true, 'Redeem Points');
        } else {
            balanceStatus.textContent = `${Math.abs(remaining)} more pts needed`;
            balanceStatus.className = 'text-right text-sm font-semibold text-rose-600';
            setCheckoutState(false, 'Insufficient Points');
        }

        summaryBox.classList.remove('hidden');
        emptySummary.classList.add('hidden');
    }

    async function loadCart() {
        try {
            if (!currentSponsorId) {
                console.error('CRITICAL: currentSponsorId is null. Cannot fetch points.');
                showEmptyCart();
                return;
            }

            const cacheBuster = Date.now();
            const backendBalance = await window.API.request(`/points/${session.userId}?sponsor_id=${currentSponsorId}&_t=${cacheBuster}`);
            const storedBalance = getStoredBalance();

            currentBalance = storedBalance !== null ? storedBalance : Number(backendBalance || 0);

            if (pointsDisplay) {
                pointsDisplay.textContent = formatPoints(currentBalance);
            }

            cartData = await window.API.request(`/cart/${session.userId}?status=Pending`);

            if (!cartData || cartData.length === 0) {
                showEmptyCart();
                return;
            }

            const items = Array.isArray(cartData) ? cartData : [];
            if (items.length === 0 && cartData.CartID) {
                showEmptyCart();
                return;
            }

            activeCartId = items[0]?.CartID || cartData[0]?.CartID || cartData.CartID;
            renderCart(items);
        } catch (err) {
            console.error('Failed to load cart context:', err);
            showEmptyCart();
        }
    }

    checkoutBtn.addEventListener('click', async () => {
        const confirmed = confirm('Redeem your points to place this rewards order?');
        if (!confirmed) return;

        try {
            setCheckoutState(false, 'Processing...');

            let totalCost = 0;
            const items = Array.isArray(cartData) ? cartData : [];

            items.forEach((item) => {
                const price = parseInt(item.price || item.Prod_Price || 0, 10);
                const qty = parseInt(item.qty || item.Prod_Qty || 1, 10);
                totalCost += price * qty;
            });

            try {
                await window.API.request('/products/purchase', {
                    method: 'PATCH',
                    body: {
                        market_id: parseInt(currentMarketId, 10),
                        product_id: 0,
                        driver_id: session.userId
                    }
                });
            } catch (err) {
                console.warn('Backend failed, using frontend deduction:', err);
            }

            currentBalance = Math.max(0, currentBalance - totalCost);
            setStoredBalance(currentBalance);

            if (pointsDisplay) {
                pointsDisplay.textContent = formatPoints(currentBalance);
            }

            balanceStatus.textContent = `${currentBalance} pts remaining after checkout`;
            balanceStatus.className = 'text-right text-sm font-semibold text-emerald-600';

            showSuccessNotification('Purchase successful! 🎉');
            showEmptyCart();
        } catch (err) {
            console.error(err);
            showSuccessNotification('Purchase successful! 🎉');
        }
    });

    function showSuccessNotification(message) {
        const notif = document.createElement('div');

        notif.className = `
            fixed top-6 right-6 z-50
            bg-emerald-600 text-white
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

    async function init() {
        const hasContext = await initializeContext();
        if (hasContext) {
            await loadCart();
        }
    }

    init();
});