document.addEventListener('DOMContentLoaded', async () => {
    const cartContainer = document.getElementById('cart-items-list');
    const summaryBox = document.getElementById('order-summary');
    const totalDisplay = document.getElementById('total-cost');
    const checkoutBtn = document.getElementById('checkout-btn');
    const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user") || 'null');
    const effectiveRole = window.GDUserView?.getEffectiveRole(session) || String(session?.role || '').toLowerCase();
    const driverPreview = !!window.GDUserView?.isDriverViewActive?.(session);

    if (!session) { window.location.href = "login.html"; return; }
    if (effectiveRole !== 'driver') {
        window.location.href = "index.html";
        return;
    }

    let cartData = [];
    let currentBalance = 0;

    async function loadCart() {
        try {
            currentBalance = driverPreview ? 0 : await window.API.request(`/points/${session.userId}`);
            currentBalance = typeof currentBalance === 'number' ? currentBalance : (currentBalance?.total_points || 0);
            
            cartData = JSON.parse(localStorage.getItem("gd_cart")) || [];

            if (cartData.length === 0) {
                cartContainer.innerHTML = `<div class="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <p class="text-slate-400 font-medium italic">Your cart is empty.</p>
                </div>`;
                summaryBox.classList.add('hidden');
                return;
            }

            cartContainer.innerHTML = '';
            if (driverPreview) {
                cartContainer.insertAdjacentHTML('beforeend', `
                    <div class="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                        <strong>Preview cart:</strong> sponsor users can review the cart flow here, but checkout is disabled in Driver View.
                    </div>
                `);
            }
            let total = 0;

            cartData.forEach(item => {
                const itemPrice = item.price || 5; 
                total += itemPrice;

                const itemRow = document.createElement('div');
                itemRow.className = "bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm";
                itemRow.innerHTML = `
                    <div>
                        <h3 class="font-bold text-slate-900">${item.product_name}</h3>
                        <p class="text-xs text-slate-400 uppercase font-bold">Item ID: #${item.Cart_ID}</p>
                    </div>
                    <div class="flex items-center gap-6">
                        <span class="font-black text-blue-600">${itemPrice} pts</span>
                        <button onclick="removeItem(${item.Cart_ID})" class="text-slate-300 hover:text-red-500 font-bold">✕</button>
                    </div>
                `;
                cartContainer.appendChild(itemRow);
            });

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
                checkoutBtn.textContent = "Confirm Order";
                checkoutBtn.className = "w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-blue-600 transition-colors";
            }
        } catch (err) {
            console.error("Failed to load cart context:", err);
        }
    }

    checkoutBtn.addEventListener('click', async () => {
        if (driverPreview) {
            alert('Checkout is disabled while previewing Driver View as a sponsor user.');
            return;
        }

        const total = parseInt(totalDisplay.textContent);
        const confirmed = confirm(`Redeem ${cartData.length} items for ${total} points?`);
        if (!confirmed) return;

        try {
            await window.API.request("/points", {
                method: "PATCH",
                body: {
                    driverID: session.userId,
                    points_change: -total,
                    reason: `Cart Checkout: ${cartData.length} items`
                }
            });

            localStorage.removeItem("gd_cart");
            alert("Order Successful! Your rewards are on the way.");
            window.location.href = "store_catalog.html";
        } catch (err) {
            alert("Checkout failed: " + err.message);
        }
    });

    window.removeItem = (cartId) => {
        let localCart = JSON.parse(localStorage.getItem("gd_cart")) || [];
        localCart = localCart.filter(item => item.Cart_ID !== cartId);
        localStorage.setItem("gd_cart", JSON.stringify(localCart));
        loadCart();
    };

    loadCart();
});
