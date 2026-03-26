document.addEventListener('DOMContentLoaded', async () => {
    const pointsDisplay = document.getElementById('display-points');
    const catalogContainer = document.getElementById('catalog-container');
    const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user") || 'null');
    const effectiveRole = window.GDUserView?.getEffectiveRole(session) || String(session?.role || '').toLowerCase();
    const driverPreview = !!window.GDUserView?.isDriverViewActive?.(session);

    async function loadHeaderStats() {
        try {
            if (session?.userId && !driverPreview) {
                const points = await window.API.request(`/points/${session.userId}`);
                pointsDisplay.textContent = typeof points === 'number' ? points : (points?.total_points || 0);
            } else if (pointsDisplay) {
                pointsDisplay.textContent = driverPreview ? 'Preview' : '0';
            }

            const localCart = JSON.parse(localStorage.getItem("gd_cart")) || [];
            updateCartUI(localCart.length);
        } catch (error) {
            console.error("Header sync failed:", error);
            if (pointsDisplay && driverPreview) pointsDisplay.textContent = 'Preview';
        }
    }

    function updateCartUI(count) {
        let badge = document.getElementById('cart-count-badge');
        if (!badge) {
            const cartLink = document.querySelector('a[href="cart.html"]') || document.querySelector('nav');
            badge = document.createElement('span');
            badge.id = 'cart-count-badge';
            badge.className = "ml-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full";
            cartLink.appendChild(badge);
        }
        badge.textContent = count;
    }

    const mockProducts = [
        {
            id: "ebay-test-001",
            name: "Sony Wireless Noise Cancelling Headphones",
            image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=600&q=80",
            price_pts: 5
        }
    ];

    function renderCatalog() {
        if (!catalogContainer) return;
        catalogContainer.innerHTML = '';

        if (effectiveRole !== 'driver') {
            catalogContainer.innerHTML = `
                <div class="p-12 text-center col-span-full bg-white rounded-3xl border border-slate-200">
                    <h2 class="text-2xl font-bold text-slate-900 mb-2">Driver access required</h2>
                    <p class="text-slate-500">This catalog is available to drivers. Sponsor users can use Driver View in the navigation to preview it.</p>
                </div>
            `;
            return;
        }

        if (driverPreview) {
            const previewNote = document.createElement('div');
            previewNote.className = "col-span-full mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900";
            previewNote.innerHTML = `<strong>Preview mode:</strong> You can browse the driver catalog, but cart checkout is disabled for sponsor users.`;
            catalogContainer.appendChild(previewNote);
        }

        mockProducts.forEach(product => {
            const card = document.createElement('div');
            card.className = "bg-white rounded-3xl border border-slate-200 overflow-hidden p-4";
    
            card.innerHTML = `
                <img src="${product.image}" class="w-full h-40 object-cover rounded-2xl mb-4">
                <h3 class="font-bold text-slate-900">${product.name}</h3>
                <p class="text-blue-600 font-black mb-4">${product.price_pts} pts</p>
                <button onclick="addToCart('${product.id}', '${product.name.replace(/'/g, "\\'")}')" 
                        class="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-600 transition-colors">
                    ${driverPreview ? 'Preview Add to Cart' : 'Add to Cart'}
                </button>
            `;
            catalogContainer.appendChild(card);
        });
    }

    window.addToCart = async (productId, productName) => {
        const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user") || 'null');
        if (!session) {
            alert("Please log in again.");
            return;
        }

        const previewMode = !!window.GDUserView?.isDriverViewActive?.(session);
        const role = window.GDUserView?.getEffectiveRole(session) || String(session.role || '').toLowerCase();
        if (role !== 'driver') {
            alert('Only drivers can use the rewards store.');
            return;
        }

        let localCart = JSON.parse(localStorage.getItem("gd_cart")) || [];

        localCart.push({
            Cart_ID: Date.now(), 
            product_id: productId,
            product_name: productName,
            price: 5,
            preview_only: previewMode
        });

        localStorage.setItem("gd_cart", JSON.stringify(localCart));

        alert(previewMode
            ? `${productName} added to the preview cart. Checkout will stay disabled in Driver View.`
            : `${productName} added to your cart!`);
        
        updateCartUI(localCart.length);
    };

    loadHeaderStats();
    renderCatalog();
});
