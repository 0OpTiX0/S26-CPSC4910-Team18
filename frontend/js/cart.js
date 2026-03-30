document.addEventListener('DOMContentLoaded', async () => {
    const cartContainer = document.getElementById('cart-items-list');
    const summaryBox = document.getElementById('order-summary');
    const totalDisplay = document.getElementById('total-cost');
    const checkoutBtn = document.getElementById('checkout-btn');
    const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user"));

    if (!session) { window.location.href = "login.html"; return; }

    let cartData = [];
    let currentBalance = 0;
    let currentSponsorId = null;
    let currentMarketId = null;
    let activeCartId = null;

    // --- 1. Robust Context Initialization ---
    async function initializeContext() {
        try {
            const sponsorships = await window.API.request(`/admin/get_sponsor_list?driver_id=${session.userId}`);
            
            // Check if it's an array and has items
            if (Array.isArray(sponsorships) && sponsorships.length > 0) {
                currentSponsorId = sponsorships[0].Sponsor_ID;
            } else {
                console.warn("Could not find a sponsor via /admin/get_sponsor_list. Attempting fallback...");
                // Fallback: If your app has a default sponsor (e.g., ID 1), use it so testing doesn't halt.
                currentSponsorId = 1; 
            }

            const savedMarketKey = `gd_market_id_sponsor_${currentSponsorId}`;
            currentMarketId = localStorage.getItem(savedMarketKey) || 1; 
            return true;
        } catch (error) {
            console.error("Failed to load context:", error);
            // Fallback for total failure
            currentSponsorId = 1;
            currentMarketId = 1;
            return true;
        }
    }

    // --- 2. Load Cart ---
    async function loadCart() {
        try {
            // Guard clause to prevent 422s!
            if (!currentSponsorId) {
                console.error("CRITICAL: currentSponsorId is null. Cannot fetch points.");
                showEmptyCart();
                return;
            }

            const cacheBuster = Date.now();
            currentBalance = await window.API.request(`/points/${session.userId}?sponsor_id=${currentSponsorId}&_t=${cacheBuster}`);
            
            const pointsDisplay = document.getElementById('display-points');
            if (pointsDisplay) pointsDisplay.textContent = `${currentBalance} pts`;

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

            cartContainer.innerHTML = '';
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

            totalDisplay.textContent = `${total} pts`;
            summaryBox.classList.remove('hidden');
            
            if (currentBalance < total) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = "Insufficient Points";
                checkoutBtn.className = "w-full bg-slate-700 text-slate-500 py-4 rounded-2xl font-black cursor-not-allowed";
            } else {
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = "Place Order";
                checkoutBtn.className = "w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-blue-600 transition-colors";
            }
        } catch (err) {
            console.error("Failed to load cart context:", err);
            showEmptyCart();
        }
    }

    function showEmptyCart() {
        cartContainer.innerHTML = `<div class="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <p class="text-slate-400 font-medium italic">Your cart is empty.</p>
        </div>`;
        summaryBox.classList.add('hidden');
    }

    checkoutBtn.addEventListener('click', async () => {
        const confirmed = confirm(`Redeem points to place this order?`);
        if (!confirmed) return;

        try {
            checkoutBtn.disabled = true;
            checkoutBtn.textContent = "Processing...";

            await window.API.request("/products/purchase", {
                method: "PATCH",
                body: {
                    market_id: parseInt(currentMarketId),
                    product_id: 0, 
                    driver_id: session.userId 
                }
            });

            alert("Order Successful! Your rewards are on the way.");
            window.location.href = "store_catalog.html";
        } catch (err) {
            const msg = typeof err.message === 'object' ? JSON.stringify(err.message) : err.message;
            alert(`Checkout failed: ${msg}`);
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = "Place Order";
        }
    });

    window.removeItem = async (cartId, cartItemId) => {
        try {
            await window.API.request(`/cart/${session.userId}/${cartItemId}`, {
                method: "DELETE"
            });
            
            loadCart();
        } catch (error) {
            console.error("Failed to remove item", error);
            alert("Could not remove item from cart.");
        }
    };

    async function init() {
        const hasContext = await initializeContext();
        if (hasContext) {
            loadCart();
        }
    }

    init();
});