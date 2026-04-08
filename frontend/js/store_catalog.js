document.addEventListener('DOMContentLoaded', async () => {
    const pointsDisplay = document.getElementById('display-points');
    const catalogContainer = document.getElementById('catalog-container');
    const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user"));

    if (!session) {
        window.location.href = "login.html";
        return;
    }

    let currentSponsorId = null;
    let currentMarketId = null;

    async function initializeStoreContext() {
        try {
            const sponsorships = await window.API.request(`/admin/get_sponsor_list?driver_id=${session.userId}`);
            
            if (Array.isArray(sponsorships) && sponsorships.length > 0) {
                currentSponsorId = sponsorships[0].Sponsor_ID;
            } else {
                console.warn("Could not find a sponsor via /admin/get_sponsor_list. Attempting fallback...");
                currentSponsorId = 1; 
            }

            const savedMarketKey = `gd_market_id_sponsor_${currentSponsorId}`;
            currentMarketId = localStorage.getItem(savedMarketKey) || 1; 

            return true;
        } catch (error) {
            console.error("Failed to initialize store context:", error);
            currentSponsorId = 1;
            currentMarketId = 1;
            return true;
        }
    }

    async function loadHeaderStats() {
        if (!currentSponsorId) {
            console.error("CRITICAL: currentSponsorId is null. Cannot fetch points.");
            updateCartUI(0);
            return;
        }

        try {
            const cacheBuster = Date.now();
            const points = await window.API.request(`/points/${session.userId}?sponsor_id=${currentSponsorId}&_t=${cacheBuster}`);
            pointsDisplay.textContent = points;

            const cartWrapper = await window.API.request(`/cart/${session.userId}?status=Pending`);
            
            if (cartWrapper && cartWrapper.length > 0) {
                updateCartUI("!");
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
        if (!cart_count) {
            const cartLink = document.querySelector('a[href="cart.html"]') || document.querySelector('nav');
            cart_count = document.createElement('span');
            cart_count.id = 'cart-count-badge';
            cart_count.className = "absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white";
            cartLink.appendChild(cart_count);
        }
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
        if (!catalogContainer || !currentMarketId) return;
        
        try {
            const products = await window.API.request(`/products/${currentMarketId}`);

            if (!products || products.length === 0) {
                catalogContainer.innerHTML = `
                    <div class="p-12 text-center col-span-full border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                        <p class="text-slate-500 font-medium italic">Your sponsor hasn't added any products to this market yet.</p>
                    </div>`;
                return;
            }

            renderCatalog(products);
        } catch (error) {
            console.error("Failed to load products:", error);
            showError("Failed to load catalog. Ensure your backend is running.");
        }
    }

    function renderCatalog(products) {
        catalogContainer.innerHTML = '';

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = "bg-white rounded-3xl border border-slate-200 overflow-hidden p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col";
    
            card.innerHTML = `
                <img src="${product.Product_Image || 'https://via.placeholder.com/600'}" alt="Product Image" class="w-full h-40 object-cover rounded-2xl mb-4">
                <h3 class="font-bold text-slate-900 line-clamp-2 mb-2 flex-grow" title="${product.Product_Name}">${product.Product_Name}</h3>
                <p class="text-xs text-slate-500 line-clamp-2 mb-4" title="${product.Product_Description}">${product.Product_Description || "No description."}</p>
                <p class="text-blue-600 font-black mb-4">${product.Product_Price} pts</p>
                
                <button onclick="addToCart(${product.ProductID}, '${product.Product_Name.replace(/'/g, "\\'")}')" 
                        class="w-full mt-auto bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-600 transition-colors">
                    Add to Cart
                </button>
            `;
            catalogContainer.appendChild(card);
        });
    }

    window.addToCart = async (productId, productName) => {
        try {
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
            loadHeaderStats();
            
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

    async function init() {
        const hasContext = await initializeStoreContext();
        if (hasContext) {
            loadHeaderStats();
            loadProducts();
        }
    }

    init();
});