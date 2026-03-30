document.addEventListener('DOMContentLoaded', async () => {
    const session = JSON.parse(sessionStorage.getItem('gd_user') || 'null');

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const role = String(session.role || '').toLowerCase();
    if (!role.includes('sponsor')) {
        alert('Only sponsor users can access the market builder.');
        window.location.href = 'index.html';
        return;
    }

    const sponsorBadge = document.getElementById('sponsorBadge');
    const marketNameEl = document.getElementById('marketName');
    const marketDescriptionEl = document.getElementById('marketDescription');
    const createMarketBtn = document.getElementById('createMarketBtn');
    const reloadMarketBtn = document.getElementById('reloadMarketBtn');
    const clearSavedMarketBtn = document.getElementById('clearSavedMarketBtn');
    const marketStatusEl = document.getElementById('marketStatus');
    const marketStatePill = document.getElementById('marketStatePill');

    const ebayInputEl = document.getElementById('ebayInput');
    const addProductBtn = document.getElementById('addProductBtn');
    const productStatusEl = document.getElementById('productStatus');
    const refreshCatalogBtn = document.getElementById('refreshCatalogBtn');
    const catalogGrid = document.getElementById('catalogGrid');
    const catalogCountPill = document.getElementById('catalogCountPill');

    const summaryMarketId = document.getElementById('summaryMarketId');
    const summaryMarketName = document.getElementById('summaryMarketName');
    const summaryMarketDescription = document.getElementById('summaryMarketDescription');
    const storageKeyLabel = document.getElementById('storageKeyLabel');
    const logoutBtn = document.getElementById('logoutBtn');

    let sponsor = null;
    let currentMarket = null;

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
        }
        return error?.message || fallback;
    }

    function setStatus(el, msg, kind = 'info') {
        if (!el) return;
        el.textContent = msg || '';
        el.className = 'text-sm ' + (
            kind === 'error' ? 'text-rose-600' :
            kind === 'success' ? 'text-emerald-600' :
            'text-slate-500'
        );
    }

    function marketStorageKey() {
        const sponsorId = sponsor?.Sponsor_ID ?? sponsor?.sponsor_id ?? 'unknown';
        return `gd_market_id_sponsor_${sponsorId}`;
    }

    function updateSummary() {
        const marketId = currentMarket?.Market_ID ?? currentMarket?.market_id;
        const marketName = currentMarket?.Market_Name ?? currentMarket?.market_name;
        const marketDescription = currentMarket?.Market_Description ?? currentMarket?.market_description;

        summaryMarketId.textContent = marketId ?? '—';
        summaryMarketName.textContent = marketName || '—';
        summaryMarketDescription.textContent = marketDescription || 'No market selected.';
        storageKeyLabel.textContent = marketStorageKey();

        if (marketId) {
            marketStatePill.textContent = `Market #${marketId}`;
            marketStatePill.className = 'text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700';
        } else {
            marketStatePill.textContent = 'No Market';
            marketStatePill.className = 'text-xs font-bold px-3 py-1 rounded-full bg-slate-200 text-slate-700';
        }
    }

    function setCatalogLoading(message = 'Loading catalog...') {
        catalogGrid.innerHTML = `
            <div class="col-span-full py-12 text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
                <p class="text-slate-500 font-medium">${escHtml(message)}</p>
            </div>
        `;
    }

    function renderCatalog(products) {
        catalogCountPill.textContent = `${products.length} Product${products.length === 1 ? '' : 's'}`;

        if (!products.length) {
            catalogGrid.innerHTML = `
                <div class="col-span-full py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
                    <div class="text-4xl mb-3">🛍️</div>
                    <h3 class="text-lg font-bold text-slate-900">No products in this market yet</h3>
                    <p class="text-slate-500 mt-1">Use the eBay import field above to add the first product.</p>
                </div>
            `;
            return;
        }

        catalogGrid.innerHTML = products.map((product) => {
            const productId = product?.ProductID ?? product?.product_id ?? product?.Product_ID ?? '—';
            const title = product?.Product_Name ?? product?.product_name ?? 'Untitled Product';
            const description = product?.Product_Description ?? product?.product_description ?? '';
            const price = product?.Product_Price ?? product?.product_price ?? 0;
            const qty = product?.Product_Qty ?? product?.product_qty ?? 0;
            const image = product?.Product_Image ?? product?.product_image ?? '';
            const refreshed = product?.Last_Refreshed ?? product?.last_refreshed ?? null;
            const refreshedText = refreshed ? new Date(refreshed).toLocaleString() : '—';

            return `
                <article class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <div class="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
                        ${image
                            ? `<img src="${escHtml(image)}" alt="${escHtml(title)}" class="w-full h-full object-cover">`
                            : `<div class="text-slate-400 text-sm font-medium">No image</div>`}
                    </div>
                    <div class="p-5 space-y-3">
                        <div class="flex items-start justify-between gap-3">
                            <h3 class="font-bold text-slate-900 leading-6">${escHtml(title)}</h3>
                            <span class="shrink-0 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-bold">${escHtml(price)} pts</span>
                        </div>
                        <p class="text-sm text-slate-500 min-h-[3rem]">${escHtml(description || 'No description available.')}</p>
                        <div class="grid grid-cols-2 gap-3 text-xs text-slate-500">
                            <div class="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                                <div class="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1">Product ID</div>
                                <div class="font-semibold text-slate-700">${escHtml(productId)}</div>
                            </div>
                            <div class="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                                <div class="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1">Available Qty</div>
                                <div class="font-semibold text-slate-700">${escHtml(qty)}</div>
                            </div>
                            <div class="col-span-2 rounded-2xl bg-slate-50 p-3 border border-slate-100">
                                <div class="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1">Last refreshed</div>
                                <div class="font-semibold text-slate-700">${escHtml(refreshedText)}</div>
                            </div>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    function parseEbayItemId(input) {
        const raw = String(input || '').trim();
        if (!raw) return '';
        if (/^\d{9,15}$/.test(raw)) return raw;

        const matchers = [
            /\/itm\/(?:[^/?]+\/)?(\d{9,15})/i,
            /[?&]item=(\d{9,15})/i,
            /[?&]itemid=(\d{9,15})/i,
            /[?&]id=(\d{9,15})/i,
            /(\d{9,15})/
        ];

        for (const regex of matchers) {
            const match = raw.match(regex);
            if (match?.[1]) return match[1];
        }
        return '';
    }

    async function resolveSponsor() {
        sponsor = await window.API.request(`/sponsor-user/resolve?email=${encodeURIComponent(session.email)}`);
        const sponsorName = sponsor?.Sponsor_Name ?? sponsor?.sponsor_name ?? session.name ?? 'Sponsor';
        sponsorBadge.textContent = sponsorName;
        sponsorBadge.classList.remove('hidden');
        storageKeyLabel.textContent = marketStorageKey();
    }

    async function hydrateMarketFromStorage() {
        const storedMarketId = localStorage.getItem(marketStorageKey());
        if (!storedMarketId) {
            currentMarket = null;
            updateSummary();
            setCatalogLoading('No saved market found yet. Create one to begin.');
            catalogCountPill.textContent = '0 Products';
            return;
        }

        try {
            currentMarket = await window.API.request(`/market?market_id=${encodeURIComponent(storedMarketId)}`);
            const marketName = currentMarket?.Market_Name ?? currentMarket?.market_name ?? '';
            const marketDescription = currentMarket?.Market_Description ?? currentMarket?.market_description ?? '';
            marketNameEl.value = marketName;
            marketDescriptionEl.value = marketDescription;
            updateSummary();
            await loadCatalog();
            setStatus(marketStatusEl, `Loaded saved market #${storedMarketId}.`, 'success');
        } catch (error) {
            currentMarket = null;
            updateSummary();
            setCatalogLoading('Saved market could not be loaded. Clear the saved link and create a new market.');
            setStatus(marketStatusEl, `Saved market #${storedMarketId} could not be loaded: ${getErrorMessage(error)}`, 'error');
        }
    }

    async function loadCatalog() {
        const marketId = currentMarket?.Market_ID ?? currentMarket?.market_id;
        if (!marketId) {
            renderCatalog([]);
            return;
        }

        try {
            setCatalogLoading('Fetching current catalog...');
            const products = await window.API.request(`/products/${marketId}`);
            renderCatalog(Array.isArray(products) ? products : []);
        } catch (error) {
            console.error(error);
            catalogGrid.innerHTML = `
                <div class="col-span-full py-12 text-center bg-white rounded-3xl border border-rose-200 text-rose-600">
                    <div class="text-4xl mb-3">⚠️</div>
                    <h3 class="text-lg font-bold">Could not load catalog</h3>
                    <p class="mt-1 text-sm">${escHtml(getErrorMessage(error))}</p>
                </div>
            `;
            catalogCountPill.textContent = '0 Products';
        }
    }

    createMarketBtn?.addEventListener('click', async () => {
        const name = marketNameEl.value.trim();
        const description = marketDescriptionEl.value.trim();

        if (!name) {
            setStatus(marketStatusEl, 'Market name is required.', 'error');
            return;
        }

        try {
            createMarketBtn.disabled = true;
            setStatus(marketStatusEl, 'Creating market...', 'info');
            const sponsorEmail = sponsor?.Sponsor_Email ?? sponsor?.sponsor_email ?? session.email;
            const market = await window.API.request(`/market?sponsor_email=${encodeURIComponent(sponsorEmail)}`, {
                method: 'POST',
                body: { name, description }
            });

            currentMarket = market;
            const marketId = market?.Market_ID ?? market?.market_id;
            localStorage.setItem(marketStorageKey(), String(marketId));
            updateSummary();
            renderCatalog([]);
            setStatus(marketStatusEl, `Market created successfully. Saved market #${marketId} for this sponsor.`, 'success');
        } catch (error) {
            console.error(error);
            setStatus(marketStatusEl, getErrorMessage(error, 'Could not create market.'), 'error');
        } finally {
            createMarketBtn.disabled = false;
        }
    });

    addProductBtn?.addEventListener('click', async () => {
        const marketId = currentMarket?.Market_ID ?? currentMarket?.market_id;
        if (!marketId) {
            setStatus(productStatusEl, 'Create or load a market before adding products.', 'error');
            return;
        }

        const ebayItemId = parseEbayItemId(ebayInputEl.value);
        if (!ebayItemId) {
            setStatus(productStatusEl, 'Enter a valid eBay item ID or listing URL.', 'error');
            return;
        }

        try {
            addProductBtn.disabled = true;
            setStatus(productStatusEl, `Importing eBay item ${ebayItemId}...`, 'info');
            await window.API.request(`/products/${marketId}?ebayItemID=${encodeURIComponent(ebayItemId)}`, {
                method: 'POST'
            });
            ebayInputEl.value = '';
            setStatus(productStatusEl, `Item ${ebayItemId} added to the market.`, 'success');
            await loadCatalog();
        } catch (error) {
            console.error(error);
            setStatus(productStatusEl, getErrorMessage(error, 'Could not import the eBay product.'), 'error');
        } finally {
            addProductBtn.disabled = false;
        }
    });

    refreshCatalogBtn?.addEventListener('click', loadCatalog);
    reloadMarketBtn?.addEventListener('click', hydrateMarketFromStorage);

    clearSavedMarketBtn?.addEventListener('click', () => {
        localStorage.removeItem(marketStorageKey());
        currentMarket = null;
        updateSummary();
        renderCatalog([]);
        setStatus(marketStatusEl, 'Saved market link cleared for this sponsor.', 'success');
        setStatus(productStatusEl, '');
    });

    logoutBtn?.addEventListener('click', () => {
        sessionStorage.removeItem('gd_user');
        localStorage.removeItem('gd_user');
        window.location.href = 'login.html';
    });

    try {
        await resolveSponsor();
        updateSummary();
        await hydrateMarketFromStorage();
    } catch (error) {
        console.error(error);
        updateSummary();
        setCatalogLoading('Could not load sponsor context.');
        setStatus(marketStatusEl, getErrorMessage(error, 'Could not resolve sponsor account.'), 'error');
    }
});
