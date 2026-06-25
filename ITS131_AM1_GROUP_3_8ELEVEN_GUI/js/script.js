// DATA STATE
const defaultState = {
    currentUser: null,
    categories: [],
    users: [],
    pendingAccounts: [],
    products: [],
    transactions: [],
    stockInLogs: [],
    cart: [],
    offlineCartQueue: JSON.parse(localStorage.getItem('8eleven_offline_queue') || '[]'),
    stockInSelectedVariantId: null
};

let state = JSON.parse(JSON.stringify(defaultState));

function saveState() {
    localStorage.setItem('8eleven_state_backup', JSON.stringify(state));
}

async function loadStateFromServer() {
    if (!navigator.onLine) {
        const backup = localStorage.getItem('8eleven_state_backup');
        if (backup) {
            const parsed = JSON.parse(backup);
            state = { ...state, ...parsed };
        }
        return;
    }
    
    try {
        const response = await fetch('backend/api.php?action=get_state');
        const data = await response.json();
        if (data.status === 'success') {
            state.categories = data.state.categories;
            state.users = data.state.users;
            state.pendingAccounts = data.state.pendingAccounts;
            state.products = data.state.products;
            state.transactions = data.state.transactions;
            state.stockInLogs = data.state.stockInLogs;
            saveState();
        } else {
            console.error('API Error:', data.message);
        }
    } catch (err) {
        console.error('Failed to load state from server:', err);
    }
}

// Page titles
const pageMeta = {
    dashboard: { title: 'Dashboard', sub: 'Overview of your store performance' },
    pos: { title: 'Sales / POS Terminal', sub: 'Select products and process transactions' },
    inventory: { title: 'Products & Variants', sub: 'Manage your product catalog' },
    categories: { title: 'Categories', sub: 'Organize products into groups' },
    stockin: { title: 'Stock-In / Restock', sub: 'Log deliveries and update quantities' },
    transactions: { title: 'Transaction Reports', sub: 'Sales history and export tools' },
    utilities: { title: 'System Utilities', sub: 'Backup and restore store data' },
};

// INIT
document.addEventListener('DOMContentLoaded', async () => {
    initOfflineListeners();
    await loadStateFromServer();
    lucide.createIcons();
    switchView('login');
    updateClock();
    setInterval(updateClock, 60000);
});

function updateClock() {
    const el = document.getElementById('header-datetime');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    }
}

function initOfflineListeners() {
    window.addEventListener('online', () => toggleOfflineBanner(false));
    window.addEventListener('offline', () => toggleOfflineBanner(true));
    if (!navigator.onLine) toggleOfflineBanner(true);
}
function toggleOfflineBanner(isOffline) {
    const b = document.getElementById('offline-banner');
    if (isOffline) b.classList.remove('hidden'); else b.classList.add('hidden');
}

// ROUTER
async function switchView(viewId) {
    if (!state.currentUser && viewId !== 'login') viewId = 'login';

    const views = ['login', 'dashboard', 'pos', 'inventory', 'categories', 'stockin', 'transactions', 'utilities'];
    views.forEach(v => {
        const nav = document.getElementById(`nav-${v}`);
        if (nav) nav.classList.remove('active');
    });

    const nav = document.getElementById(`nav-${viewId}`);
    if (nav) nav.classList.add('active');

    const container = document.getElementById('view-container');
    if (container) {
        try {
            const response = await fetch(`${viewId}.html`);
            if (!response.ok) throw new Error('View not found');
            const html = await response.text();
            container.innerHTML = html;
        } catch (err) {
            console.error('Failed to load view:', err);
            container.innerHTML = '<div style="padding:20px; color:#e06060;">Failed to load view dynamically. Please ensure you are running the project through a local web server (e.g. VS Code Live Server).</div>';
            return;
        }
    }

    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('top-header');
    if (viewId === 'login') {
        sidebar.classList.add('hidden'); sidebar.style.display = 'none';
        if (header) { header.classList.add('hidden'); header.style.display = 'none'; }
    } else {
        sidebar.classList.remove('hidden'); sidebar.style.display = 'flex';
        if (header) { header.classList.remove('hidden'); header.style.display = 'flex'; }
        const meta = pageMeta[viewId] || { title: viewId, sub: '' };
        document.getElementById('page-title-text').textContent = meta.title;
        document.getElementById('page-subtitle-text').textContent = meta.sub;

        if (viewId === 'dashboard') renderDashboardOverview();
        if (viewId === 'pos') { initPosViewDropdowns(); renderPosGrid(); renderPosCart(); }
        if (viewId === 'inventory') renderInventoryMasterCatalog();
        if (viewId === 'categories') renderCategoriesCatalog();
        if (viewId === 'stockin') { initStockInGrid(); renderStockInLogsTable(); }
        if (viewId === 'transactions') renderTransactionLedger();
        renderPendingAccountApprovals();
    }
    lucide.createIcons();
}

// AUTH
function handleLoginDirect() {
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;
    const account = state.users.find(u => u.username === user && u.password === pass && u.active !== false);
    if (account) {
        state.currentUser = { userId: account.userId, username: account.username, fullName: account.fullName, role: account.role };
    } else {
        alert('Invalid credentials or account not yet approved.'); return;
    }
    const initials = state.currentUser.fullName.split(' ').map(n => n[0]).join('').substring(0, 2);
    document.getElementById('current-user-fullname').textContent = state.currentUser.fullName;
    document.getElementById('current-user-role').textContent = state.currentUser.role;
    document.getElementById('avatar-letters').textContent = initials;
    document.getElementById('header-avatar').textContent = initials;
    document.getElementById('header-username').textContent = state.currentUser.fullName.split(' ')[0];
    switchView('dashboard');
}

function handleLogin(e) { e.preventDefault(); handleLoginDirect(); }

function logout() {
    state.currentUser = null;
    switchView('login');
}

async function handleAccountRequest(e) {
    e.preventDefault();
    const fullName = document.getElementById('request-fullname').value.trim();
    const username = document.getElementById('request-username').value.trim();
    const password = document.getElementById('request-password').value;
    const role = document.getElementById('request-role').value;
    if (!fullName || !username || !password || !role) return;
    
    if (state.users.some(u => u.username === username) || state.pendingAccounts.some(r => r.username === username)) {
        alert('That username is already taken. Choose another username.');
        return;
    }

    try {
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'request_account', fullName, username, password, role })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert('Account request submitted. An owner must approve it before you can sign in.');
            document.getElementById('request-fullname').value = '';
            document.getElementById('request-username').value = '';
            document.getElementById('request-password').value = '';
            document.getElementById('request-role').value = 'Cashier';
            await loadStateFromServer();
            renderPendingAccountApprovals();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to submit account request:', err);
        alert('Failed to submit account request.');
    }
}

function renderOwnerNotifications() {
    const banner = document.getElementById('owner-notification-banner');
    const text = document.getElementById('owner-notification-text');
    if (!banner || !text) return;
    const pendingCount = state.pendingAccounts.length;
    const isOwner = state.currentUser && state.currentUser.role.toLowerCase().includes('owner');
    if (isOwner && pendingCount > 0) {
        banner.classList.remove('hidden');
        text.textContent = `${pendingCount} account request${pendingCount !== 1 ? 's' : ''} waiting approval.`;
    } else {
        banner.classList.add('hidden');
    }
}

function renderPendingAccountApprovals() {
    const container = document.getElementById('sidebar-approval-container');
    if (!container) return;
    container.innerHTML = '';
    if (!state.currentUser || !state.currentUser.role.toLowerCase().includes('owner')) return;

    const panel = document.createElement('div');
    panel.id = 'pending-approval-panel';
    panel.className = 'sidebar-approval-panel';

    const isExpanded = state.approvalPanelExpanded !== false;
    const toggle = document.createElement('div');
    toggle.className = `sidebar-approval-toggle${isExpanded ? '' : ' collapsed'}`;
    const title = document.createElement('span');
    title.textContent = 'Approval Request';
    const icon = document.createElement('i');
    icon.setAttribute(
        'data-lucide',
        isExpanded ? 'chevron-up' : 'chevron-down'
    );
    icon.style.marginRight = '3px';
    toggle.appendChild(title);
    toggle.appendChild(icon);
    toggle.onclick = () => {
        state.approvalPanelExpanded = !state.approvalPanelExpanded;
        renderPendingAccountApprovals();
    };
    panel.appendChild(toggle);

    if (!isExpanded) {
        container.appendChild(panel);
        lucide.createIcons();
        return;
    }

    if (state.pendingAccounts.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sidebar-approval-empty';
        empty.textContent = 'No pending account requests.';
        empty.style.marginTop = '10px';
        panel.appendChild(empty);
    } else {
        const list = document.createElement('div');
        list.className = 'sidebar-approval-list';
        list.style.maxHeight = '300px';
        list.style.overflowY = 'auto';
        list.style.overflowX = 'hidden';
        list.style.marginTop = '10px';
        list.style.paddingRight = '4px';
        state.pendingAccounts.forEach(req => {
            const card = document.createElement('div');
            card.className = 'sidebar-approval-card';
            card.innerHTML = `
                <h5>${req.fullName}</h5>
                <p>Username: <strong>${req.username}</strong></p>
                <p>Role requested: <strong>${req.role}</strong></p>
            `;

            const meta = document.createElement('div');
            meta.className = 'sidebar-approval-meta';
            meta.innerHTML = `
                <span>${new Date(req.requestedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                <span>ID #${req.requestId}</span>
            `;
            card.appendChild(meta);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';
            actions.style.flexWrap = 'wrap';

            const approveBtn = document.createElement('button');
            approveBtn.type = 'button';
            approveBtn.className = 'sidebar-approval-action';
            approveBtn.textContent = 'Approve';
            approveBtn.onclick = () => approvePendingAccount(req.requestId);

            const rejectBtn = document.createElement('button');
            rejectBtn.type = 'button';
            rejectBtn.className = 'sidebar-approval-action';
            rejectBtn.textContent = 'Reject';
            rejectBtn.style.background = '#f5b7b1';
            rejectBtn.style.color = '#5d1f1a';
            rejectBtn.onclick = () => rejectPendingAccount(req.requestId);

            actions.appendChild(approveBtn);
            actions.appendChild(rejectBtn);
            card.appendChild(actions);
            list.appendChild(card);
        });
        panel.appendChild(list);
    }
    container.appendChild(panel);
    lucide.createIcons();
}

async function approvePendingAccount(requestId) {
    const request = state.pendingAccounts.find(r => r.requestId === requestId);
    if (!request) return;
    try {
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve_account', requestId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert(`Account approved for ${request.fullName}. They can now log in.`);
            await loadStateFromServer();
            renderPendingAccountApprovals();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to approve account:', err);
    }
}

async function rejectPendingAccount(requestId) {
    const request = state.pendingAccounts.find(r => r.requestId === requestId);
    if (!request) return;
    if (!confirm(`Reject account request from ${request.fullName}?`)) return;
    try {
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject_account', requestId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert(`Account request from ${request.fullName} has been rejected.`);
            await loadStateFromServer();
            renderPendingAccountApprovals();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to reject account:', err);
    }
}

// DASHBOARD
function renderDashboardOverview() {
    let todaySum = 0, weekSum = 0, monthSum = 0;
    const now = new Date();
    state.transactions.forEach(tx => {
        const d = new Date(tx.date), diff = now - d;
        if (diff <= 86400000) todaySum += tx.totalAmount;
        if (diff <= 604800000) weekSum += tx.totalAmount;
        if (diff <= 2592000000) monthSum += tx.totalAmount;
    });
    document.getElementById('kpi-sales-today').textContent = `₱${todaySum.toFixed(2)}`;
    document.getElementById('kpi-sales-week').textContent = `₱${weekSum.toFixed(2)}`;
    document.getElementById('kpi-sales-month').textContent = `₱${monthSum.toFixed(2)}`;

    // Alerts
    const alertBody = document.getElementById('table-body-stock-alerts');
    alertBody.innerHTML = '';
    let alertCount = 0;
    state.products.forEach(p => {
        p.variants.forEach(v => {
            const outOfStock = v.stockQuantity === 0;
            const lowStock = v.stockQuantity <= v.reorderPoint && v.stockQuantity > 0;
            if (outOfStock || lowStock) {
                alertCount++;
                const tr = document.createElement('tr');
                tr.className = outOfStock ? 'alert-row-critical' : 'alert-row-warning';
                tr.innerHTML = `
                    <td class="alerts-table-name">${p.name}</td>
                    <td class="alerts-table-variant">${v.name}</td>
                    <td class="alerts-table-qty ${outOfStock ? 'critical' : 'warning'}">${v.stockQuantity} ${v.unitOfMeasure}s</td>
                    <td class="alerts-table-status">${outOfStock ? '<span class="badge badge-red">Out of Stock</span>' : '<span class="badge badge-amber">Low Stock</span>'}</td>
                `;
                alertBody.appendChild(tr);
            }
        });
    });
    document.getElementById('count-stock-alerts').textContent = `${alertCount} item${alertCount !== 1 ? 's' : ''}`;
    if (alertCount === 0) alertBody.innerHTML = `<tr><td colspan="4" class="table-empty-state">All items within safe stock levels ✓</td></tr>`;

    // Best sellers
    const salesMap = {};
    state.transactions.forEach(tx => {
        tx.items.forEach(item => {
            if (!salesMap[item.variantId]) salesMap[item.variantId] = { qty: 0, rev: 0 };
            salesMap[item.variantId].qty += item.quantity;
            salesMap[item.variantId].rev += item.quantity * item.priceAtSale;
        });
    });
    const bsBody = document.getElementById('table-body-bestsellers');
    bsBody.innerHTML = '';
    const sorted = [];
    state.products.forEach(p => p.variants.forEach(v => {
        const s = salesMap[v.id] || { qty: 0, rev: 0 };
        sorted.push({ name: `${p.name} (${v.name})`, qty: s.qty, rev: s.rev });
    }));
    sorted.sort((a, b) => b.qty - a.qty);
    const top = sorted.filter(i => i.qty > 0).slice(0, 5);
    if (top.length === 0) {
        bsBody.innerHTML = `<tr><td colspan="3" class="table-empty-state">Process sales to see best sellers.</td></tr>`;
    } else {
        top.forEach((item, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div style="display:flex;align-items:center;gap:10px;"><span class="best-seller-rank">${idx + 1}</span><span class="best-seller-name">${item.name}</span></div></td>
                <td class="alerts-table-qty">${item.qty}</td>
                <td class="alerts-table-qty" style="color:#4a9e2f;">₱${item.rev.toFixed(2)}</td>
            `;
            bsBody.appendChild(tr);
        });
    }
    renderSalesTrendGraph();
    lucide.createIcons();
}

function renderSalesTrendGraph() {
    const chart = document.getElementById('sales-trend-chart');
    if (!chart) return;
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, idx) => {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(now.getDate() - (6 - idx));
        return { date: day, label: day.toLocaleDateString('en-PH', { weekday: 'short' }).substring(0, 3), total: 0 };
    });
    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        txDate.setHours(0, 0, 0, 0);
        const day = days.find(d => d.date.getTime() === txDate.getTime());
        if (day) day.total += tx.totalAmount;
    });
    const maxVal = Math.max(...days.map(d => d.total));
    const maxTotal = maxVal > 0 ? maxVal : 50;
    chart.innerHTML = `
        <div class="trend-header">
            <div>
                <p style="margin:0;font-size:12px;color:#7d9e7b;">Last 7 days performance</p>
            </div>
            <span>${state.transactions.length} transactions</span>
        </div>
        <div class="sales-trend-bar-row">
            ${days.map(d => `
                <div class="sales-trend-bar">
                    <div class="sales-trend-bar-value">₱${d.total.toFixed(0)}</div>
                    <div class="sales-trend-bar-inner" style="height:${d.total === 0 ? 2 : (d.total / maxTotal) * 100}%;"></div>
                    <div class="sales-trend-bar-label">${d.label}</div>
                </div>
            `).join('')}
        </div>
    `;
    saveState();
}

// POS
function initPosViewDropdowns() {
    const sel = document.getElementById('pos-category-filter');
    sel.innerHTML = '<option value="all">All Categories</option>';
    state.categories.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
}

function renderPosGrid() {
    const grid = document.getElementById('pos-catalog-grid');
    grid.innerHTML = '';
    const kw = document.getElementById('pos-search-input').value.toLowerCase();
    const cat = document.getElementById('pos-category-filter').value;
    state.products.forEach(p => {
        if (cat !== 'all' && p.categoryId !== parseInt(cat)) return;
        if (!p.name.toLowerCase().includes(kw)) return;
        p.variants.forEach(v => {
            const oos = v.stockQuantity <= 0;
            const card = document.createElement('div');
            card.className = `pos-product-card${oos ? ' sold-out' : ''}`;
            card.innerHTML = `
                <div>
                    <div class="product-card-header">
                        <span class="product-name">${p.name}</span>
                        <span class="unit-pill">${v.unitOfMeasure}</span>
                    </div>
                    <div class="variant-name">${v.name}</div>
                    <div class="price-label">₱${v.unitPrice.toFixed(2)}</div>
                </div>
                <div class="card-footer">
                    <span class="stock-status ${v.stockQuantity === 0 ? 'critical' : ''}">
                        ${v.stockQuantity === 0 ? 'Out of Stock' : `Stock: ${v.stockQuantity}`}
                    </span>
                    <button ${oos ? 'disabled' : ''} onclick="addVariantToCart(${v.id})" class="add-btn ${oos ? 'disabled' : 'primary'}">
                        ${oos ? 'Sold Out' : '<i data-lucide="plus" style="width:12px;height:12px;"></i> Add'}
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    });
    if (grid.children.length === 0) {
        grid.innerHTML = `<div class="table-empty-state">No products match your search.</div>`;
    }
    lucide.createIcons();
}

function addVariantToCart(variantId) {
    let targetVar = null;
    state.products.forEach(p => p.variants.forEach(v => { if (v.id === variantId) targetVar = v; }));
    if (!targetVar) return;
    const existing = state.cart.find(l => l.variantId === variantId);
    if (existing) {
        if (existing.quantity + 1 > targetVar.stockQuantity) { saveState(); alert('Insufficient stock.'); return; }
        existing.quantity++;
    } else {
        if (targetVar.stockQuantity < 1) return;
        state.cart.push({ variantId, quantity: 1, meta: targetVar });
    }
    renderPosCart();
}

function updateCartQty(variantId, change) {
    const line = state.cart.find(l => l.variantId === variantId);
    if (!line) return;
    const next = line.quantity + change;
    if (next <= 0) { state.cart = state.cart.filter(l => l.variantId !== variantId); }
    else { if (next > line.meta.stockQuantity) { alert('Stock limit reached.'); return; } line.quantity = next; }
    renderPosCart();
}

function updateCartQtyByInput(variantId, value) {
    const quantity = parseInt(value, 10);
    const line = state.cart.find(l => l.variantId === variantId);
    if (!line) return;
    if (isNaN(quantity) || quantity <= 0) {
        line.quantity = 1;
    } else if (quantity > line.meta.stockQuantity) {
        alert('Stock limit reached.');
        line.quantity = line.meta.stockQuantity;
    } else {
        line.quantity = quantity;
    }
    renderPosCart();
}

function clearActiveCart() {
    state.cart = [];
    renderPosCart();
    const tender = document.getElementById('pos-tendered-input');
    if (tender) tender.value = '';
    updateTenderChange();
    saveState();
}

function renderPosCart() {
    const container = document.getElementById('pos-cart-container');
    if (!container) return;
    container.innerHTML = '';

    let grand = 0;

    state.cart.forEach(line => {
        const v = line.meta;
        const p = state.products.find(pr => pr.variants.some(vr => vr.id === v.id));
        const pricePerUnit = v.unitPrice;
        const finalTotal = pricePerUnit * line.quantity;

        grand += finalTotal;

        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <div>
                    <div style="font-family:'Poppins',sans-serif;font-weight:700;font-size:13px;color:#1a3d1f;">${p ? p.name : ''}</div>
                    <div style="font-size:11px;color:#9ab89c;">${v.name} • ₱${v.unitPrice.toFixed(2)}/${v.unitOfMeasure}</div>
                </div>
                <div style="font-family:'Poppins',sans-serif;font-weight:800;font-size:14px;color:#1a3d1f;">₱${finalTotal.toFixed(2)}</div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <button onclick="updateCartQty(${v.id},-1)" class="qty-button">−</button>
                    <input type="number" min="1" max="${v.stockQuantity}" value="${line.quantity}" onchange="updateCartQtyByInput(${v.id}, this.value)" class="qty-input" />
                    <button onclick="updateCartQty(${v.id},1)" class="qty-button">+</button>
                </div>
            </div>
        `;
        container.appendChild(el);
    });

    if (state.cart.length === 0) {
        container.innerHTML = `<div class="cart-empty-panel"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg><p style="font-size:12px;color:#9ab89c;">Add products to start a sale.</p></div>`;
    }

    const totalEl = document.getElementById('cart-summary-total');
    if (totalEl) {
        totalEl.textContent = `₱${grand.toFixed(2)}`;
    }

    updateTenderChange();
}

function updateTenderChange() {
    const total = parseFloat(document.getElementById('cart-summary-total').textContent.replace('₱', '')) || 0;
    const method = document.getElementById('pos-payment-method')?.value || 'Cash';
    const tenderedInput = document.getElementById('pos-tendered-input');

    if (method === 'GCash' && tenderedInput) {
        tenderedInput.value = total.toFixed(2);
        tenderedInput.readOnly = true;
    }

    const tendered = parseFloat(tenderedInput?.value) || 0;
    const change = tendered - total;
    const label = document.getElementById('cart-summary-change-label');
    const amount = document.getElementById('cart-summary-change');
    if (tendered <= 0) {
        label.textContent = 'Change Due';
        amount.textContent = `₱0.00`;
        return;
    }
    if (change < 0) {
        label.textContent = 'Amount Due';
        amount.textContent = `₱${Math.abs(change).toFixed(2)}`;
    } else {
        label.textContent = 'Change Due';
        amount.textContent = `₱${change.toFixed(2)}`;
    }
}

function handlePaymentMethodChange() {
    const method = document.getElementById('pos-payment-method')?.value || 'Cash';
    const tenderedInput = document.getElementById('pos-tendered-input');
    const tenderedLabel = document.getElementById('pos-tendered-label');
    const total = parseFloat(document.getElementById('cart-summary-total').textContent.replace('₱', '')) || 0;

    if (method === 'GCash') {
        if (tenderedLabel) tenderedLabel.textContent = 'Amount Paid';
        if (tenderedInput) {
            tenderedInput.value = total.toFixed(2);
            tenderedInput.readOnly = true;
        }
    } else {
        if (tenderedLabel) tenderedLabel.textContent = 'Cash Tendered';
        if (tenderedInput) {
            tenderedInput.value = '';
            tenderedInput.readOnly = false;
        }
    }
    updateTenderChange();
}

function resetPosTenderSection() {
    const tender = document.getElementById('pos-tendered-input');
    if (tender) {
        tender.value = '';
        tender.readOnly = false;
    }
    const payMethodSelect = document.getElementById('pos-payment-method');
    if (payMethodSelect) payMethodSelect.value = 'Cash';
    const tenderedLabel = document.getElementById('pos-tendered-label');
    if (tenderedLabel) tenderedLabel.textContent = 'Cash Tendered';
}

async function commitCheckoutTransaction() {
    if (state.cart.length === 0) { alert('Cart is empty.'); return; }
    const total = parseFloat(document.getElementById('cart-summary-total').textContent.replace('₱', '')) || 0;
    const tendered = parseFloat(document.getElementById('pos-tendered-input')?.value) || 0;
    const method = document.getElementById('pos-payment-method')?.value || 'Cash';
    if (tendered < total) { alert(`${method === 'Cash' ? 'Cash' : 'Amount'} tendered is less than the total amount due.`); return; }
    if (!confirm('Are you sure with the transaction and want to proceed?')) { return; }
    const change = tendered - total;
    const newTx = {
        date: new Date().toISOString(),
        totalAmount: total,
        paymentMethod: method,
        userId: state.currentUser.userId,
        clerkName: state.currentUser.fullName,
        items: state.cart.map(line => ({
            variantId: line.variantId,
            quantity: line.quantity,
            priceAtSale: line.meta.unitPrice
        }))
    };
    if (!navigator.onLine) {
        newTx.id = Date.now();
        state.offlineCartQueue.push(newTx);
        localStorage.setItem('8eleven_offline_queue', JSON.stringify(state.offlineCartQueue));
        alert(`Offline — transaction saved locally. Total: ₱${total.toFixed(2)}. Change: ₱${change.toFixed(2)}`);
        processLocalStockDeductions();
        resetPosTenderSection();
        return;
    }
    try {
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'checkout', ...newTx })
        });
        const data = await res.json();
        if (data.status === 'success') {
            newTx.id = data.transactionId;
            state.transactions.unshift(newTx);
            processLocalStockDeductions();
            alert(`✓ Invoice #${newTx.id} posted successfully. Total: ₱${total.toFixed(2)}. Change: ₱${change.toFixed(2)}`);
            resetPosTenderSection();
            await loadStateFromServer();
        } else {
            alert('Error checking out: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to post transaction:', err);
        newTx.id = Date.now();
        state.offlineCartQueue.push(newTx);
        localStorage.setItem('8eleven_offline_queue', JSON.stringify(state.offlineCartQueue));
        processLocalStockDeductions();
        resetPosTenderSection();
    }
}

function processLocalStockDeductions() {
    state.cart.forEach(line => {
        state.products.forEach(p => p.variants.forEach(v => {
            if (v.id === line.variantId) v.stockQuantity = Math.max(0, v.stockQuantity - line.quantity);
        }));
    });
    clearActiveCart(); renderPosGrid(); renderDashboardOverview();
}

async function syncOfflineData() {
    if (state.offlineCartQueue.length === 0) { alert('No offline transactions to sync.'); return; }
    try {
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync_offline', transactions: state.offlineCartQueue })
        });
        const data = await res.json();
        if (data.status === 'success') {
            const count = state.offlineCartQueue.length;
            state.offlineCartQueue = [];
            localStorage.removeItem('8eleven_offline_queue');
            alert(`Synced ${count} offline transaction(s).`);
            await loadStateFromServer();
            renderDashboardOverview();
        } else {
            alert('Failed to sync offline transactions: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to sync offline data:', err);
        alert('Server unreachable. Could not sync offline transactions.');
    }
}

// INVENTORY CRUD
function renderInventoryMasterCatalog() {
    const tbody = document.getElementById('table-body-inventory');
    tbody.innerHTML = '';
    state.products.forEach(p => {
        const cat = state.categories.find(c => c.id === p.categoryId);
        let varHtml = '<div style="display:flex;flex-direction:column;gap:5px;">';
        p.variants.forEach(v => {
            const warn = v.stockQuantity <= v.reorderPoint;
            varHtml += `<div style="background:#f7fdf4;border:1px solid #dfeedd;border-radius:9px;padding:8px 11px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;">
                <span style="font-weight:700;font-size:12px;color:#1a3d1f;">${v.name}</span>
                <span style="font-size:11px;color:#7a9e7c;">₱${v.unitPrice.toFixed(2)}/${v.unitOfMeasure}</span>
                <span style="font-size:11px;font-weight:700;${warn ? 'color:#c0392b;background:#fef0f0;padding:2px 8px;border-radius:6px;border:1px solid #f5b7b1;' : 'color:#4a9e2f;'}">Stock: ${v.stockQuantity}</span>
            </div>`;
        });
        varHtml += '</div>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="mono" style="font-size:11px;font-weight:600;color:#9ab89c;">#P-${p.id.toString().padStart(4, '0')}</span></td>
            <td><span style="font-family:'Poppins',sans-serif;font-weight:700;color:#1a3d1f;">${p.name}</span></td>
            <td><span class="cat-pill">${cat ? cat.name : 'Unassigned'}</span></td>
            <td style="max-width:320px;">${varHtml}</td>
            <td style="text-align:center;">
                <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                    <button onclick="openProductModal(${p.id})" class="btn-edit"><i data-lucide="edit-2" style="width:14px;height:14px;"></i></button>
                    <button onclick="handleDeleteProduct(${p.id})" class="btn-danger"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function openProductModal(productId = null) {
    const catSel = document.getElementById('modal-product-category');
    catSel.innerHTML = '';
    state.categories.forEach(c => { catSel.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
    document.getElementById('modal-variants-tbody').innerHTML = '';

    if (productId) {
        const p = state.products.find(x => x.id === productId);
        document.getElementById('product-modal-title').textContent = 'Edit Product';
        document.getElementById('modal-product-id-field').value = p.id;
        document.getElementById('modal-product-name').value = p.name;
        catSel.value = p.categoryId;
        p.variants.forEach(v => addProductModalVariantRow(v));
    } else {
        document.getElementById('product-modal-title').textContent = 'Add Product';
        document.getElementById('modal-product-id-field').value = '';
        document.getElementById('modal-product-name').value = '';
        addProductModalVariantRow();
    }
    const bd = document.getElementById('product-modal-backdrop');
    bd.style.display = 'flex'; bd.classList.remove('hidden');
    lucide.createIcons();
}

function closeProductModal() {
    const bd = document.getElementById('product-modal-backdrop');
    bd.style.display = 'none'; bd.classList.add('hidden');
}

function addProductModalVariantRow(vData = null) {
    const tbody = document.getElementById('modal-variants-tbody');
    const tr = document.createElement('tr');
    tr.className = 'variant-form-row';
    tr.innerHTML = `
        <td>
            <input type="hidden" class="v-id" value="${vData ? vData.id : ''}">
            <input type="text" class="v-name" required placeholder="e.g. Solo 40g" value="${vData ? vData.name : ''}">
        </td>
        <td><input type="text" class="v-unit" required placeholder="pack" value="${vData ? vData.unitOfMeasure : 'piece'}"></td>
        <td><input type="number" step="0.01" class="v-uprice" required placeholder="0.00" value="${vData ? vData.unitPrice : ''}"></td>
        <td><input type="number" class="v-stock" required placeholder="0" value="${vData ? vData.stockQuantity : '0'}"></td>
        <td><input type="number" class="v-reorder" required placeholder="5" value="${vData ? vData.reorderPoint : '5'}"></td>
        <td style="text-align:center;"><button type="button" onclick="this.closest('tr').remove()" style="background:none;border:none;cursor:pointer;color:#c0a0a0;padding:4px;border-radius:5px;display:flex;align-items:center;" onmouseover="this.style.color='#c0392b'" onmouseout="this.style.color='#c0a0a0'"><i data-lucide="x" style="width:14px;height:14px;"></i></button></td>
    `;
    tbody.appendChild(tr);
    lucide.createIcons();
}

async function handleProductModalSubmit(e) {
    e.preventDefault();
    const pId = document.getElementById('modal-product-id-field').value;
    const pName = document.getElementById('modal-product-name').value.trim();
    const pCat = parseInt(document.getElementById('modal-product-category').value);
    const rows = document.querySelectorAll('.variant-form-row');
    if (rows.length === 0) { alert('Add at least one variant.'); return; }
    let seed = Date.now();
    const variants = [];
    rows.forEach(row => {
        const existingIdVal = row.querySelector('.v-id')?.value;
        const vId = existingIdVal ? parseInt(existingIdVal) : seed++;
        variants.push({
            id: vId,
            name: row.querySelector('.v-name').value.trim(),
            unitOfMeasure: row.querySelector('.v-unit').value.trim(),
            unitPrice: parseFloat(row.querySelector('.v-uprice').value),
            stockQuantity: parseInt(row.querySelector('.v-stock').value),
            reorderPoint: parseInt(row.querySelector('.v-reorder').value)
        });
    });

    try {
        const payload = {
            action: 'save_product',
            productId: pId ? parseInt(pId) : null,
            name: pName,
            categoryId: pCat,
            variants: variants
        };
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            closeProductModal();
            await loadStateFromServer();
            renderInventoryMasterCatalog();
        } else {
            alert('Error saving product: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to save product:', err);
        alert('Failed to save product.');
    }
}

async function handleDeleteProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_product', id })
        });
        const data = await res.json();
        if (data.status === 'success') {
            await loadStateFromServer();
            renderInventoryMasterCatalog();
        } else {
            alert('Error deleting product: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to delete product:', err);
    }
}

// CATEGORIES
function renderCategoriesCatalog() {
    const tbody = document.getElementById('table-body-categories');
    tbody.innerHTML = '';
    state.categories.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="mono" style="font-size:11px;font-weight:600;color:#9ab89c;">#C-${c.id.toString().padStart(3, '0')}</span></td>
            <td><span style="font-family:'Poppins',sans-serif;font-weight:600;color:#1a3d1f;">${c.name}</span></td>
            <td style="text-align:center;"><button onclick="handleDeleteCategory(${c.id})" class="btn-danger"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

async function handleCategoryCreate(e) {
    e.preventDefault();
    const inp = document.getElementById('category-new-name');
    const name = inp.value.trim();
    if (!name) return;

    try {
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add_category', name })
        });
        const data = await res.json();
        if (data.status === 'success') {
            inp.value = '';
            await loadStateFromServer();
            renderCategoriesCatalog();
        } else {
            alert('Error creating category: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to create category:', err);
    }
}

async function handleDeleteCategory(id) {
    if (state.products.some(p => p.categoryId === id)) { alert('Cannot delete — products are using this category.'); return; }
    if (!confirm('Delete this category?')) return;
    try {
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_category', id })
        });
        const data = await res.json();
        if (data.status === 'success') {
            await loadStateFromServer();
            renderCategoriesCatalog();
        } else {
            alert('Error deleting category: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to delete category:', err);
    }
}

// STOCK-IN
function initStockInGrid() {
    const search = document.getElementById('stockin-search-input');
    if (search) search.value = '';
    if (!state.stockInSelectedVariantId) {
        const firstVariant = state.products?.[0]?.variants?.[0];
        state.stockInSelectedVariantId = firstVariant ? firstVariant.id : null;
    }
    renderStockInVariantCards();
}

function renderStockInVariantCards() {
    const container = document.getElementById('stockin-variant-cards');
    const searchValue = document.getElementById('stockin-search-input')?.value.toLowerCase() || '';
    container.innerHTML = '';

    const matches = [];
    state.products.forEach(p => {
        p.variants.forEach(v => {
            if (searchValue && !(`${p.name} ${v.name}`.toLowerCase().includes(searchValue))) return;
            matches.push({ product: p, variant: v });
        });
    });

    if (matches.length === 0) {
        container.innerHTML = '<div class="table-empty-state" style="padding:24px;">No matching variants found.</div>';
        document.getElementById('stockin-selected-summary').textContent = 'Select a variant to restock.';
        return;
    }

    if (!state.stockInSelectedVariantId || !matches.some(m => m.variant.id === state.stockInSelectedVariantId)) {
        state.stockInSelectedVariantId = matches[0].variant.id;
    }

    matches.forEach(({ product, variant }) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'stockin-card';
        if (variant.id === state.stockInSelectedVariantId) card.classList.add('selected');
        card.onclick = () => selectStockInVariant(variant.id);
        card.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <span class="stockin-card-product">${product.name}</span>
                <span class="stockin-card-unit">${variant.unitOfMeasure}</span>
            </div>
            <div class="stockin-card-variant">${variant.name}</div>
            <div class="stockin-card-meta">
                <span>₱${variant.unitPrice.toFixed(2)}</span>
                <span>${variant.stockQuantity} in stock</span>
            </div>
        `;
        container.appendChild(card);
    });

    renderStockInSelectionSummary();
}

function renderStockInSelectionSummary() {
    const summary = document.getElementById('stockin-selected-summary');
    const selected = getSelectedStockInVariant();
    if (!selected) {
        summary.textContent = 'Select a variant to restock.';
        return;
    }
    summary.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-weight:700;color:#1a3d1f;">${selected.product.name}</span>
            <span style="font-size:12px;color:#7d9e7b;">${selected.variant.unitOfMeasure}</span>
        </div>
        <div style="font-size:13px;color:#4f6a54;margin-bottom:6px;">${selected.variant.name}</div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#2d7a1f;font-weight:700;">
            <span>Stock</span><span>${selected.variant.stockQuantity}</span>
        </div>
    `;
}

function selectStockInVariant(variantId) {
    state.stockInSelectedVariantId = variantId;
    renderStockInVariantCards();
}

function getSelectedStockInVariant() {
    let selected = null;
    state.products.forEach(product => product.variants.forEach(variant => {
        if (variant.id === state.stockInSelectedVariantId) selected = { product, variant };
    }));
    return selected;
}

function renderStockInLogsTable() {
    const tbody = document.getElementById('table-body-stockin-logs');
    tbody.innerHTML = '';
    state.stockInLogs.forEach(log => {
        let label = 'Unknown';
        state.products.forEach(p => p.variants.forEach(v => { if (v.id === log.variantId) label = `${p.name} (${v.name})`; }));
        const dateStr = new Date(log.date).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="mono" style="font-size:11px;color:#9ab89c;">#STK-${log.id}</span></td>
            <td style="font-weight:500;">${label}</td>
            <td style="text-align:right;font-weight:700;color:#4a9e2f;">+${log.quantityAdded}</td>
            <td style="color:#7a9e7c;font-size:12px;">${dateStr}</td>
            <td style="font-size:12px;color:#9ab89c;font-style:italic;">${log.userName}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function handlePostStockIn(e) {
    e.preventDefault();
    const selected = getSelectedStockInVariant();
    const qty = parseInt(document.getElementById('stockin-quantity').value);
    if (!selected || qty <= 0) {
        alert('Please select a variant and enter a valid quantity.');
        return;
    }
    try {
        const res = await fetch('backend/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'post_stockin',
                variantId: selected.variant.id,
                quantityAdded: qty,
                userId: state.currentUser.userId,
                userName: state.currentUser.fullName
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('stockin-quantity').value = '';
            alert(`✓ Stock updated. ${selected.variant.name} now has ${data.newStock} units.`);
            await loadStateFromServer();
            state.stockInSelectedVariantId = selected.variant.id;
            renderStockInVariantCards();
            renderStockInLogsTable();
        } else {
            alert('Error updating stock: ' + data.message);
        }
    } catch (err) {
        console.error('Failed to update stock:', err);
    }
}

// TRANSACTIONS
function renderTransactionLedger() {
    const tbody = document.getElementById('table-body-transactions-ledger');
    tbody.innerHTML = '';
    const start = document.getElementById('filter-date-start').value;
    const end = document.getElementById('filter-date-end').value;
    let txs = [...state.transactions];
    if (start) txs = txs.filter(t => new Date(t.date) >= new Date(start).setHours(0, 0, 0, 0));
    if (end) txs = txs.filter(t => new Date(t.date) <= new Date(end).setHours(23, 59, 59, 999));

    txs.forEach(tx => {
        const totalUnits = tx.items.reduce((sum, item) => sum + item.quantity, 0);

        const dateStr = new Date(tx.date).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const tr = document.createElement('tr');

        const payMethod = tx.paymentMethod || 'Cash';
        const methodBadge = payMethod === 'GCash'
            ? `<span style="display:inline-block;background:#e3f2fd;color:#0d47a1;border:1px solid #bbdefb;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:700;font-family:'Poppins',sans-serif;">GCash</span>`
            : `<span style="display:inline-block;background:#e8f5e9;color:#1b5e20;border:1px solid #c8e6c9;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:700;font-family:'Poppins',sans-serif;">Cash</span>`;

        tr.innerHTML = `
        <td><span class="mono" style="font-size:11px;font-weight:600;color:#4a9e2f;">#INV-${tx.id}</span></td>
        <td style="font-size:12px;color:#7a9e7c;">${dateStr}</td>
        <td>
            <button id="toggle-btn-${tx.id}" onclick="toggleTransactionItems(${tx.id})" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#4a9e2f;background:#e8f5e0;border:1px solid #b3d98e;border-radius:7px;padding:4px 10px;cursor:pointer;font-family:'Poppins',sans-serif;">
                <i data-lucide="chevron-down" style="width:13px;height:13px;"></i> 
                ${totalUnits} item${totalUnits !== 1 ? 's' : ''}
            </button>
        </td>
        <td style="text-align:right;font-family:'Poppins',sans-serif;font-weight:800;font-size:14px;color:#1a3d1f;">₱${tx.totalAmount.toFixed(2)}</td>
        <td>${methodBadge}</td>
        <td style="font-size:12px;color:#7a9e7c;font-style:italic;">${tx.clerkName}</td>
    `;
        tbody.appendChild(tr);

        const itemsRow = document.createElement('tr');
        itemsRow.id = `items-row-${tx.id}`;
        itemsRow.className = 'hidden';
        itemsRow.style.background = '#f7fdf4';

        let iHtml = `
        <td colspan="6" style="padding:12px 20px;border-bottom:1px solid #e0f0e0;">
            <div style="display:flex;flex-direction:column;gap:8px;">
    `;

        tx.items.forEach(item => {
            let info = { name: 'Unknown', variantName: '', price: 0 };
            state.products.forEach(p => p.variants.forEach(v => {
                if (v.id === item.variantId) info = { name: p.name, variantName: v.name, price: item.priceAtSale };
            }));

            iHtml += `<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #dff0df;border-radius:10px;padding:10px 14px;">
            <div>
                <div style="font-family:'Poppins',sans-serif;font-weight:700;font-size:13px;color:#1a3d1f;">${info.name}</div>
                <div style="font-size:11px;color:#9ab89c;">${info.variantName}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:12px;font-weight:600;color:#5a7a5c;">x${item.quantity} @ ₱${info.price.toFixed(2)}</div>
                <div style="font-family:'Poppins',sans-serif;font-weight:800;font-size:14px;color:#4a9e2f;">₱${(item.quantity * info.price).toFixed(2)}</div>
            </div>
        </div>`;
        });

        iHtml += '</div></td>';
        itemsRow.innerHTML = iHtml;
        tbody.appendChild(itemsRow);
    });
    lucide.createIcons();
}

function toggleTransactionItems(txId) {
    const row = document.getElementById(`items-row-${txId}`);
    const btn = document.getElementById(`toggle-btn-${txId}`);
    if (row.classList.contains('hidden')) {
        row.classList.remove('hidden');
        btn.querySelector('svg').style.transform = 'rotate(180deg)';
    } else {
        row.classList.add('hidden');
        btn.querySelector('svg').style.transform = '';
    }
}

function resetDateFilters() {
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    renderTransactionLedger();
}

function exportReportData(type) {
    if (type === 'print') { window.print(); return; }
    let csv = 'data:text/csv;charset=utf-8,InvoiceID,Date,TotalAmount,PaymentMethod,Cashier\n';
    state.transactions.forEach(t => { csv += `${t.id},${t.date},${t.totalAmount},"${t.paymentMethod || 'Cash'}","${t.clerkName}"\n`; });
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `8_Eleven_Sales_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// UTILITIES
function executeSystemBackupDump() {
    const data = JSON.stringify(state, null, 2);
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
    a.download = `8_Eleven_Backup_${Date.now()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function executeSystemRestoreIngress(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.categories && parsed.products) {
                if (!confirm('Are you sure you want to restore this backup? This will overwrite ALL existing database data.')) return;
                
                const res = await fetch('backend/api.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'restore_backup', backupData: parsed })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    alert('✓ Backup restored successfully!');
                    await loadStateFromServer();
                    switchView('dashboard');
                } else {
                    alert('Error restoring backup: ' + data.message);
                }
            } else {
                alert('Invalid backup file format.');
            }
        } catch (err) {
            console.error('Failed to restore backup:', err);
            alert('Failed to parse backup file.');
        }
    };
    reader.readAsText(file);
}