document.addEventListener('DOMContentLoaded', async () => {
    const cartContainer = document.getElementById('cart-items-list');
    const summaryBox = document.getElementById('order-summary');
    const totalDisplay = document.getElementById('total-cost');
    const checkoutBtn = document.getElementById('checkout-btn');
    const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user"));

    if (!session) { window.location.href = "login.html"; return; }

    let cartData = [];
    let currentBalance = 0;

    async function loadCart() {
        try {
            // 1. Fetch current points and pending cart items
            currentBalance = await window.API.request(`/points/${session.userId}`);
            cartData = await window.API.request(`/cart/${session.userId}?status=Pending`);

            if (cartData.length === 0) {
                cartContainer.innerHTML = `<div class="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <p class="text-slate-400 font-medium italic">Your cart is empty.</p>
                </div>`;
                summaryBox.classList.add('hidden');
                return;
            }

            // 2. Render items and calculate total
            cartContainer.innerHTML = '';
            let total = 0;

            cartData.forEach(item => {
                // For now, using mock pricing based on the name or a default
                const itemPrice = item.price || 250; 
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
            
            // Disable button if user can't afford it
            if (currentBalance < total) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = "Insufficient Points";
                checkoutBtn.className = "w-full bg-slate-700 text-slate-500 py-4 rounded-2xl font-black cursor-not-allowed";
            }
        } catch (err) {
            console.error(err);
        }
    }

    // --- Checkout Logic ---
    checkoutBtn.addEventListener('click', async () => {
        const total = parseInt(totalDisplay.textContent);
        
        const confirmed = confirm(`Redeem ${cartData.length} items for ${total} points?`);
        if (!confirmed) return;

        try {
            // Deduct points
            await window.API.request("/points", {
                method: "PATCH",
                body: {
                    driverID: session.userId,
                    points_change: -total,
                    reason: `Cart Checkout: ${cartData.length} items`
                }
            });

            // In a real app, you would also loop through the cart items 
            // and update their status to "Purchased" or "Ordered" here.
            
            alert("Order Successful! Your rewards are on the way.");
            window.location.href = "store_catalog.html";
        } catch (err) {
            alert("Checkout failed: " + err.message);
        }
    });

    window.removeItem = async (cartId) => {
        // Here you would call a DELETE /cart/{cart_id} endpoint if you have one
        alert("Removing items functionality will be linked to your DELETE API.");
    };

    loadCart();
});