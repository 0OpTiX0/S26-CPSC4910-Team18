document.addEventListener('DOMContentLoaded', async () => {
    const pointsDisplay = document.getElementById('display-points');
    const catalogContainer = document.getElementById('catalog-container');
    const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user") || 'null');
    const effectiveRole = window.GDUserView?.getEffectiveRole(session) || String(session?.role || '').toLowerCase();
    const driverPreview = !!window.GDUserView?.isDriverViewActive?.(session);

    if (!session) {
        window.location.href = "login.html";
        return;
    }

    let currentSponsorId = null;
    let currentMarketId = null;

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

    async function initializeStoreContext() {
        try {
            const ctx = await window.GDDriverSponsors?.ensureActiveSponsor?.(session);
            currentSponsorId = ctx?.activeSponsor?.id || null;

            if (!currentSponsorId) {
                showError('No sponsor memberships were found for this driver.');
                return false;
            }

            currentMarketId = window.GDDriverSponsors?.getSavedMarketIdForSponsor?.(currentSponsorId) || null;
            return true;
        } catch (error) {
            console.error("Failed to initialize store context:", error);
            showError('Failed to load sponsor context.');
            return false;
        }
    }

    async function loadHeaderStats() {
        if (!currentSponsorId) {
            updateCartUI(0);
            return;
        }

        try {
            const cacheBuster = Date.now();
            const points = await window.API.request(`/points/${session.userId}?sponsor_id=${currentSponsorId}&_t=${cacheBuster}`);
            if (pointsDisplay) pointsDisplay.textContent = points;

            const cartWrapper = await window.API.request(`/cart/${session.userId}?status=Pending`);
            if (Array.isArray(cartWrapper) && cartWrapper.length > 0) {
                const firstItem = cartWrapper[0];
                const cartMarketId = Number(firstItem.market_id || 0);
                if (cartMarketId && currentMarketId && cartMarketId !== Number(currentMarketId)) {
                    updateCartUI('!');
                } else {
                    updateCartUI('!');
                }
            } else {
                updateCartUI(0);
            }
        } catch (error) {
            console.error("Header sync failed:", error);
            updateCartUI(0);
        }
    }

    function updateCartUI(count) {
        let cart_count = document.getElementById('cart-count-badge');
        if (!cart_count) return;
        cart_count.textContent = count;
        cart_count.style.display = count !== 0 ? 'flex' : 'none';
    }

    function showError(message) {
        if (catalogContainer) {
            catalogContainer.innerHTML = `
                <div class="p-12 text-center col-span-full text-red-500 font-bold border-2 border-dashed border-red-200 rounded-3xl bg-red-50">
                    ${message}
                </div>`;
        }
    }

    async function loadProducts() {
        if (!catalogContainer) return;
        if (!currentMarketId) {
            catalogContainer.innerHTML = `
                <div class="p-12 text-center col-span-full border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                    <p class="text-slate-500 font-medium italic">The selected sponsor does not have a market assigned yet.</p>
                </div>`;
            return;
        }
        
        try {
            const products = await window.API.request(`/products/${currentMarketId}`);

            if (!products || products.length === 0) {
                catalogContainer.innerHTML = `
                    <div class="p-12 text-center col-span-full border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                        <p class="text-slate-500 font-medium italic">This sponsor has not added any products to their market yet.</p>
                    </div>`;
                return;
            }

            renderCatalog(products);
        } catch (error) {
            console.error("Failed to load products:", error);
            showError("Failed to load catalog.");
        }
    }

    function renderCatalog(products) {
        catalogContainer.innerHTML = '';

        products.forEach(product => {
            const safeName = String(product.Product_Name || 'Product').replace(/'/g, "\\'");
            const card = document.createElement('div');
            card.className = "bg-white rounded-3xl border border-slate-200 overflow-hidden p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col";

            card.innerHTML = `
                <img src="${product.Product_Image || 'https://via.placeholder.com/600'}" alt="Product Image" class="w-full h-40 object-cover rounded-2xl mb-4">
                <h3 class="font-bold text-slate-900 line-clamp-2 mb-2 flex-grow" title="${product.Product_Name}">${product.Product_Name}</h3>
                <p class="text-xs text-slate-500 line-clamp-2 mb-4" title="${product.Product_Description}">${product.Product_Description || "No description."}</p>
                <p class="text-blue-600 font-black mb-4">${product.Product_Price} pts</p>

                <button onclick="addToCart(${product.ProductID}, '${safeName}')"
                        class="w-full mt-auto bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-600 transition-colors">
                    Add to Cart
                </button>
            `;
            catalogContainer.appendChild(card);
        });
    }

    window.addToCart = async (productId, productName) => {
        try {
            if (!currentMarketId) {
                alert('This sponsor does not have an assigned market yet.');
                return;
            }

            const pendingCart = await window.API.request(`/cart/${session.userId}?status=Pending`);
            if (Array.isArray(pendingCart) && pendingCart.length > 0) {
                const existingMarketId = Number(pendingCart[0].market_id || 0);
                if (existingMarketId && existingMarketId !== Number(currentMarketId)) {
                    alert('Your current cart belongs to a different sponsor. Please finish or clear that cart before switching sponsors.');
                    return;
                }
            }

            const activeCart = await window.API.request(`/cart/${session.userId}`, {
                method: "POST"
            });

            if (!activeCart || !activeCart.CartID) {
                throw new Error("Could not create or locate a Cart ID.");
            }

            await window.API.request(`/cart/cart_item/${activeCart.CartID}?prod_id=${productId}&prod_qty=1`, {
                method: "POST"
            });

            alert(`${productName} added to your cart!`);
            await loadHeaderStats();
        } catch (err) {
            console.error("Cart Error:", err);
            let msg = "An unknown error occurred.";

            if (err.detail) {
                msg = err.detail;
            } else if (err.data && err.data.detail) {
                msg = err.data.detail;
            } else if (err.message && err.message !== "API request failed") {
                msg = typeof err.message === 'object' ? JSON.stringify(err.message) : err.message;
            } else if (typeof err === 'string') {
                msg = err;
            }

            alert(`Failed to add to cart: ${msg}`);
        }
    };

    async function refreshForActiveSponsor() {
        const hasContext = await initializeStoreContext();
        if (hasContext) {
            await loadHeaderStats();
            await loadProducts();
        }
    }

    window.addEventListener('gd:active-sponsor-changed', refreshForActiveSponsor);

    refreshForActiveSponsor();
});
