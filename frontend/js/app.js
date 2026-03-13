// ═══════════════════════════════════════
//  KADAK JUNCTION v2.0 — Main App Logic
// ═══════════════════════════════════════

// ── Global State ──
const State = {
  user: null,
  tables: [],
  menuItems: [],
  menuGrouped: {},
  currentTableId: null,
  currentOrderId: null,
  currentBill: {}, // { menuItemId: { name, price, quantity } }
  charts: {},
  kitchenTimer: null,
};

// ══════════════════════════════════════
//  AUTH
// ══════════════════════════════════════

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const role = document.getElementById('loginRole').value;
  const password = document.getElementById('loginPassword').value;

  if (!username || !role || !password) {
    showLoginError('Please fill all fields');
    return;
  }

  try {
    const btn = document.querySelector('.btn-login');
    btn.textContent = 'Logging in...';
    btn.disabled = true;

    const { token, user } = await API.auth.login({ username, password, role });
    localStorage.setItem('kj_token', token);
    State.user = user;

    hideLoginError();
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');

    await initApp();
    toast(`Welcome back, ${user.name}! ☕`, 'success');
  } catch (err) {
    showLoginError(err.message);
  } finally {
    const btn = document.querySelector('.btn-login');
    btn.textContent = 'Login →';
    btn.disabled = false;
  }
}

async function logout() {
  if (!confirm('Are you sure you want to logout?')) return;
  try { await API.auth.logout(); } catch (_) {}
  localStorage.removeItem('kj_token');
  State.user = null;
  State.currentTableId = null;
  State.currentOrderId = null;
  State.currentBill = {};
  clearInterval(State.kitchenTimer);

  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginRole').value = '';
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = '⚠ ' + msg;
  el.classList.remove('hidden');
}
function hideLoginError() {
  document.getElementById('loginError').classList.add('hidden');
}

function togglePassword() {
  const inp = document.getElementById('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════

async function initApp() {
  // Update header
  document.getElementById('headerUserName').textContent = State.user.name;
  document.getElementById('headerRole').textContent = State.user.role;
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });

  // Show/hide manager-only tabs
  document.querySelectorAll('.manager-only').forEach(el => {
    el.style.display = ['Manager', 'Cashier'].includes(State.user.role) ? '' : 'none';
  });

  // Load data
  await Promise.all([loadMenu(), loadTables()]);
  renderTablesGrid();
  renderMenu();
}

// ══════════════════════════════════════
//  TAB NAVIGATION
// ══════════════════════════════════════

function switchTab(tabName, btnEl) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById('tab-' + tabName);
  if (panel) panel.classList.remove('hidden');
  if (btnEl) btnEl.classList.add('active');

  clearInterval(State.kitchenTimer);

  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'inventory') loadInventory();
  if (tabName === 'reports')   loadReport();
  if (tabName === 'staff')     loadStaff();
  if (tabName === 'kitchen') {
    loadKitchen();
    State.kitchenTimer = setInterval(loadKitchen, 15000);
  }
}

// ══════════════════════════════════════
//  TABLES
// ══════════════════════════════════════

async function loadTables() {
  try {
    State.tables = await API.tables();
  } catch (err) { console.error('Load tables:', err); }
}

function renderTablesGrid() {
  const grid = document.getElementById('tablesGrid');
  grid.innerHTML = '';
  State.tables.forEach(t => {
    const div = document.createElement('div');
    div.className = `table-btn ${t.status === 'occupied' ? 'occupied' : ''}`;
    div.id = `table-${t.id}`;
    if (State.currentTableId === t.id) div.classList.add('selected');
    div.onclick = () => selectTable(t.id);
    div.innerHTML = `
      <div class="table-number">${t.name}</div>
      <div class="table-status">${t.item_count > 0 ? t.item_count + ' items' : 'Available'}</div>
      <div class="table-amount">${t.current_total ? '₹' + t.current_total : ''}</div>
    `;
    grid.appendChild(div);
  });
}

async function selectTable(tableId) {
  State.currentTableId = tableId;

  // Update UI selection
  document.querySelectorAll('.table-btn').forEach(b => b.classList.remove('selected'));
  const btn = document.getElementById('table-' + tableId);
  if (btn) btn.classList.add('selected');

  const table = State.tables.find(t => t.id === tableId);
  document.getElementById('currentTableLabel').textContent = table?.name || `Table ${tableId}`;

  // Load existing order for this table
  try {
    const order = await API.orders.getByTable(tableId);
    if (order) {
      State.currentOrderId = order.id;
      // Rebuild currentBill from order items
      State.currentBill = {};
      order.items.forEach(item => {
        State.currentBill[item.menu_item_id] = {
          name: item.item_name,
          price: item.item_price,
          quantity: item.quantity,
          orderItemId: item.id,
        };
      });
    } else {
      State.currentOrderId = null;
      State.currentBill = {};
    }
  } catch (_) {
    State.currentOrderId = null;
    State.currentBill = {};
  }

  renderBill();
}

// ══════════════════════════════════════
//  MENU
// ══════════════════════════════════════

async function loadMenu() {
  try {
    const data = await API.menu.getAll();
    State.menuItems = data.items;
    State.menuGrouped = data.grouped;
  } catch (err) { console.error('Load menu:', err); }
}

function renderMenu(searchTerm = '') {
  const container = document.getElementById('menuContainer');
  container.innerHTML = '';

  const term = searchTerm.toLowerCase();

  Object.entries(State.menuGrouped).forEach(([category, items]) => {
    const filtered = items.filter(i =>
      i.is_available && (!term || i.name.toLowerCase().includes(term))
    );
    if (filtered.length === 0) return;

    const catDiv = document.createElement('div');
    catDiv.className = 'menu-category';
    catDiv.innerHTML = `<div class="category-title">${category === 'Beverages' ? '🍵' : '🍪'} ${category}</div>`;

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'menu-items';

    filtered.forEach(item => {
      const div = document.createElement('div');
      div.className = `menu-item ${item.stock === 0 ? 'out-of-stock' : item.stock <= item.min_stock ? 'low-stock' : ''}`;
      div.onclick = () => addItemToBill(item);
      div.innerHTML = `
        <span class="item-name">${item.name}</span>
        <span class="item-price">₹${item.price}</span>
        <span class="stock-badge">${item.stock}</span>
      `;
      itemsDiv.appendChild(div);
    });

    catDiv.appendChild(itemsDiv);
    container.appendChild(catDiv);
  });
}

function filterMenu(val) { renderMenu(val); }

// ══════════════════════════════════════
//  BILLING
// ══════════════════════════════════════

async function addItemToBill(item) {
  if (!State.currentTableId) {
    toast('Please select a table first!', 'warn');
    return;
  }
  if (item.stock <= 0) {
    toast(`${item.name} is out of stock!`, 'error');
    return;
  }

  if (State.currentBill[item.id]) {
    State.currentBill[item.id].quantity += 1;
  } else {
    State.currentBill[item.id] = { name: item.name, price: item.price, quantity: 1 };
  }

  // Update stock in local state for UI
  const menuItem = State.menuItems.find(m => m.id === item.id);
  if (menuItem) menuItem.stock -= 1;
  renderMenu(document.getElementById('menuSearch').value);
  renderBill();

  // If no open order, create one now; else add item
  await syncOrderToServer(item.id, 1);
}

async function syncOrderToServer(menuItemId, quantity) {
  try {
    if (!State.currentOrderId) {
      // Create new order
      const result = await API.orders.create({
        table_id: State.currentTableId,
        items: Object.entries(State.currentBill).map(([id, data]) => ({
          menu_item_id: parseInt(id),
          quantity: data.quantity,
        })),
        customer_name: document.getElementById('customerName').value.trim() || null,
        customer_phone: document.getElementById('customerPhone').value.trim() || null,
      });
      State.currentOrderId = result.order_id;
    } else {
      // Add to existing order
      await API.orders.addItems(State.currentOrderId, [{
        menu_item_id: menuItemId,
        quantity,
      }]);
    }
    await loadTables();
    renderTablesGrid();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function changeQuantity(menuItemId, delta) {
  if (!State.currentBill[menuItemId]) return;

  if (delta < 0 && State.currentBill[menuItemId].quantity <= 1) {
    // Remove item
    if (State.currentOrderId && State.currentBill[menuItemId].orderItemId) {
      try {
        await API.orders.removeItem(State.currentOrderId, State.currentBill[menuItemId].orderItemId);
      } catch (err) { toast(err.message, 'error'); return; }
    }
    const menuItem = State.menuItems.find(m => m.id === parseInt(menuItemId));
    if (menuItem) menuItem.stock += 1;
    delete State.currentBill[menuItemId];
  } else {
    State.currentBill[menuItemId].quantity += delta;
    if (State.currentOrderId) {
      try {
        if (delta > 0) {
          await API.orders.addItems(State.currentOrderId, [{ menu_item_id: parseInt(menuItemId), quantity: 1 }]);
        }
        // Note: decrement not handled via API in this demo - refresh from server
      } catch (err) { toast(err.message, 'error'); }
    }
    const menuItem = State.menuItems.find(m => m.id === parseInt(menuItemId));
    if (menuItem) menuItem.stock -= delta;
  }

  renderMenu(document.getElementById('menuSearch').value);
  renderBill();
  await loadTables();
  renderTablesGrid();
}

function renderBill() {
  const container = document.getElementById('billItems');
  const items = Object.entries(State.currentBill);

  if (items.length === 0) {
    container.innerHTML = '<div class="bill-empty">Select a table and add items</div>';
    recalcBill();
    return;
  }

  container.innerHTML = '';
  items.forEach(([id, item]) => {
    const div = document.createElement('div');
    div.className = 'bill-item';
    div.innerHTML = `
      <div style="flex:1">
        <div class="bill-item-name">${item.name}</div>
        <div class="bill-item-price">₹${item.price} each</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQuantity(${id}, -1)">−</button>
        <span class="qty-display">${item.quantity}</span>
        <button class="qty-btn" onclick="changeQuantity(${id}, 1)">+</button>
      </div>
      <div class="bill-item-total">₹${item.price * item.quantity}</div>
    `;
    container.appendChild(div);
  });

  recalcBill();
}

function recalcBill() {
  const subtotal = Object.values(State.currentBill).reduce((s, i) => s + i.price * i.quantity, 0);
  const gst = document.getElementById('gstEnabled').checked ? Math.round(subtotal * 0.18) : 0;
  const total = subtotal + gst;
  document.getElementById('billSubtotal').textContent = `₹${subtotal}`;
  document.getElementById('billGst').textContent = `₹${gst}`;
  document.getElementById('billTotal').textContent = `₹${total}`;
  document.getElementById('gstRow').style.display = gst > 0 ? '' : 'none';
}

async function checkout() {
  if (!State.currentTableId) return toast('Select a table first', 'warn');
  if (!State.currentOrderId || Object.keys(State.currentBill).length === 0) {
    return toast('No items in bill', 'warn');
  }

  const payMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'cash';

  // Show UPI modal if UPI selected
  if (payMethod === 'upi') {
    const subtotal = Object.values(State.currentBill).reduce((s, i) => s + i.price * i.quantity, 0);
    const gst = document.getElementById('gstEnabled').checked ? Math.round(subtotal * 0.18) : 0;
    document.getElementById('upiAmount').textContent = subtotal + gst;
    document.getElementById('upiModal').classList.remove('hidden');
    return;
  }

  await finalizeCheckout(payMethod);
}

async function confirmUpiPayment() {
  closeModal('upiModal');
  await finalizeCheckout('upi');
}

async function finalizeCheckout(paymentMethod) {
  try {
    const gstEnabled = document.getElementById('gstEnabled').checked;
    const order = await API.orders.checkout(State.currentOrderId, {
      gst_enabled: gstEnabled,
      payment_method: paymentMethod,
    });

    showReceipt(order);

    // Reset state
    State.currentBill = {};
    State.currentOrderId = null;
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';

    await loadMenu();
    await loadTables();
    renderTablesGrid();
    renderBill();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function clearTable() {
  if (!State.currentTableId) return;
  if (Object.keys(State.currentBill).length === 0) return;
  if (!confirm('Clear all items from this table?')) return;

  // Restore stock
  Object.entries(State.currentBill).forEach(([id, item]) => {
    const m = State.menuItems.find(m => m.id === parseInt(id));
    if (m) m.stock += item.quantity;
  });

  State.currentBill = {};
  State.currentOrderId = null;
  renderBill();
  renderMenu(document.getElementById('menuSearch').value);
  await loadTables();
  renderTablesGrid();
  toast('Table cleared', 'success');
}

// ══════════════════════════════════════
//  RECEIPT
// ══════════════════════════════════════

function showReceipt(order) {
  const now = new Date(order.closed_at || Date.now());
  document.getElementById('rBillNo').textContent = order.bill_number;
  document.getElementById('rDate').textContent = now.toLocaleDateString('en-IN');
  document.getElementById('rTime').textContent = now.toLocaleTimeString('en-IN');
  document.getElementById('rTable').textContent = `Table ${order.table_id}`;
  document.getElementById('rStaff').textContent = State.user.name;
  document.getElementById('rPayment').textContent = order.payment_method?.toUpperCase() || 'CASH';

  const custEl = document.getElementById('rCustomer');
  if (order.customer_name || order.customer_phone) {
    custEl.textContent = [order.customer_name, order.customer_phone].filter(Boolean).join(' | ');
    custEl.classList.remove('hidden');
  } else {
    custEl.classList.add('hidden');
  }

  const itemsEl = document.getElementById('rItems');
  itemsEl.innerHTML = (order.items || []).map(item =>
    `<div class="receipt-item"><span>${item.item_name} x${item.quantity}</span><span>₹${item.item_price * item.quantity}</span></div>`
  ).join('');

  const summaryEl = document.getElementById('rSummary');
  summaryEl.innerHTML = `
    <div class="receipt-summary-row"><span>Subtotal</span><span>₹${order.subtotal}</span></div>
    ${order.gst_amount > 0 ? `<div class="receipt-summary-row"><span>GST (18%)</span><span>₹${order.gst_amount}</span></div>` : ''}
  `;

  document.getElementById('rTotal').textContent = order.total;
  document.getElementById('receiptModal').classList.remove('hidden');
}

function printReceipt() { window.print(); }

function closeReceipt() {
  document.getElementById('receiptModal').classList.add('hidden');
}

// ══════════════════════════════════════
//  KITCHEN / KOT
// ══════════════════════════════════════

async function loadKitchen() {
  try {
    const orders = await API.orders.getActive();
    const grid = document.getElementById('kotGrid');

    if (orders.length === 0) {
      grid.innerHTML = '<div class="empty-state">🍳 No active orders right now</div>';
      return;
    }

    grid.innerHTML = '';
    orders.forEach(order => {
      const card = document.createElement('div');
      card.className = 'kot-card';
      const elapsed = Math.floor((Date.now() - new Date(order.created_at)) / 60000);
      card.innerHTML = `
        <div class="kot-header">
          <div>
            <div class="kot-table">${order.table_name}</div>
            <div class="kot-staff">👤 ${order.staff_name}</div>
          </div>
          <div>
            <div class="kot-time">${elapsed}m ago</div>
            <div style="font-size:0.7rem;opacity:0.7">#${order.bill_number}</div>
          </div>
        </div>
        <div class="kot-items">
          ${order.items.map(item => `
            <div class="kot-item">
              <span class="kot-item-name">${item.item_name}</span>
              <span class="kot-item-qty">×${item.quantity}</span>
              <button class="kot-status-btn status-${item.kot_status}"
                onclick="cycleKOTStatus(${order.id}, ${item.id}, '${item.kot_status}')">
                ${kotStatusLabel(item.kot_status)}
              </button>
            </div>
          `).join('')}
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Kitchen load:', err);
  }
}

function kotStatusLabel(status) {
  return { pending: '⏳ Pending', preparing: '🔥 Preparing', ready: '✅ Ready', served: '🍽 Served' }[status] || status;
}

async function cycleKOTStatus(orderId, itemId, current) {
  const next = { pending: 'preparing', preparing: 'ready', ready: 'served', served: 'served' }[current];
  if (next === current) return;
  try {
    await API.orders.updateKOT(orderId, itemId, next);
    loadKitchen();
  } catch (err) { toast(err.message, 'error'); }
}

// ══════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════

async function loadDashboard() {
  try {
    const data = await API.analytics.dashboard();

    document.getElementById('statTodayRevenue').textContent = `₹${Math.round(data.today.total_revenue)}`;
    document.getElementById('statTodayOrders').textContent = data.today.total_orders;
    document.getElementById('statMonthRevenue').textContent = `₹${Math.round(data.month.total_revenue)}`;
    document.getElementById('statAvgOrder').textContent = `₹${Math.round(data.today.avg_order_value)}`;
    document.getElementById('statActiveTables').textContent = data.active_tables;
    document.getElementById('statLowStock').textContent = data.low_stock_alerts.length;

    renderRevenueChart(data.last_7_days);
    renderCategoryChart(data.category_revenue);
    renderHourlyChart(data.hourly_breakdown);
    renderPaymentChart(data.payment_breakdown);
    renderTopItems(data.top_items);
    renderLowStockAlerts(data.low_stock_alerts);
  } catch (err) { console.error('Dashboard:', err); }
}

function renderRevenueChart(data) {
  const ctx = document.getElementById('revenueChart').getContext('2d');
  if (State.charts.revenue) State.charts.revenue.destroy();

  // Fill in missing days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const map = Object.fromEntries(data.map(d => [d.date, d]));
  const labels = days.map(d => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));
  const revenue = days.map(d => map[d]?.revenue || 0);
  const orders = days.map(d => map[d]?.orders || 0);

  State.charts.revenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue (₹)',
          data: revenue,
          backgroundColor: 'rgba(200,118,43,0.15)',
          borderColor: '#c8762b',
          borderWidth: 2,
          borderRadius: 6,
          yAxisID: 'y',
        },
        {
          label: 'Orders',
          data: orders,
          type: 'line',
          borderColor: '#2979c8',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#2979c8',
          tension: 0.4,
          yAxisID: 'y1',
        }
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans' } } } },
      scales: {
        y: { beginAtZero: true, position: 'left', ticks: { callback: v => '₹' + v } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } },
      },
    },
  });
}

function renderCategoryChart(data) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (State.charts.category) State.charts.category.destroy();

  if (!data || data.length === 0) return;

  State.charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.category),
      datasets: [{
        data: data.map(d => d.revenue),
        backgroundColor: ['#c8762b', '#2979c8', '#2d9e6b', '#7c3aed'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'DM Sans' }, padding: 12 } },
        tooltip: { callbacks: { label: (c) => ` ₹${c.raw}` } }
      },
      cutout: '65%',
    },
  });
}

function renderHourlyChart(data) {
  const ctx = document.getElementById('hourlyChart').getContext('2d');
  if (State.charts.hourly) State.charts.hourly.destroy();

  const allHours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const map = Object.fromEntries(data.map(d => [d.hour, d]));
  const orders = allHours.map(h => map[h]?.orders || 0);

  State.charts.hourly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allHours.map(h => h + ':00'),
      datasets: [{
        label: 'Orders',
        data: orders,
        backgroundColor: orders.map(v => v > 0 ? 'rgba(200,118,43,0.7)' : 'rgba(200,118,43,0.08)'),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

function renderPaymentChart(data) {
  const ctx = document.getElementById('paymentChart').getContext('2d');
  if (State.charts.payment) State.charts.payment.destroy();

  if (!data || data.length === 0) return;

  State.charts.payment = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map(d => d.payment_method.toUpperCase()),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: ['#2d9e6b', '#2979c8', '#7c3aed'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans' }, padding: 10 } } },
    },
  });
}

function renderTopItems(items) {
  const list = document.getElementById('topItemsList');
  if (!items || items.length === 0) { list.innerHTML = '<div style="color:#999;font-size:0.8rem">No sales today</div>'; return; }

  const maxQty = Math.max(...items.map(i => i.qty));
  list.innerHTML = items.map((item, idx) => `
    <div class="top-item-row">
      <div class="top-item-rank">${idx + 1}</div>
      <div style="flex:1">
        <div class="top-item-name">${item.item_name}</div>
        <div class="top-item-bar" style="width:${(item.qty / maxQty * 100)}%"></div>
      </div>
      <span class="top-item-qty">${item.qty} sold</span>
      <span class="top-item-rev">₹${item.revenue}</span>
    </div>
  `).join('');
}

function renderLowStockAlerts(items) {
  const list = document.getElementById('lowStockList');
  if (!items || items.length === 0) {
    list.innerHTML = '<div style="color:#2d9e6b;font-size:0.82rem;padding:8px">✅ All items well stocked</div>';
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="low-stock-row ${item.stock === 0 ? 'critical' : 'warning'}">
      <span><strong>${item.name}</strong> <span style="font-size:0.75rem;opacity:0.8">(${item.category})</span></span>
      <span class="low-stock-badge">${item.stock}</span>
    </div>
  `).join('');
}

// ══════════════════════════════════════
//  INVENTORY
// ══════════════════════════════════════

async function loadInventory() {
  await loadMenu();
  renderInventoryGrid();
}

function renderInventoryGrid(searchTerm = '') {
  const grid = document.getElementById('inventoryGrid');
  grid.innerHTML = '';
  const term = searchTerm.toLowerCase();

  State.menuItems
    .filter(i => i.is_available && (!term || i.name.toLowerCase().includes(term)))
    .forEach(item => {
      const status = item.stock === 0 ? 'out-of-stock' : item.stock <= item.min_stock ? 'low-stock' : '';
      const statusLabel = item.stock === 0 ? 'out' : item.stock <= item.min_stock ? 'low' : 'ok';

      const card = document.createElement('div');
      card.className = `inventory-card ${status}`;
      card.innerHTML = `
        <div class="inv-category">${item.category}</div>
        <div class="inv-name">${item.name}</div>
        <div class="inv-price">₹${item.price}</div>
        <div class="inv-stock-info">
          <span>Current: <strong class="inv-stock-val">${item.stock}</strong></span>
          <span>Min: ${item.min_stock}</span>
        </div>
        <div class="inv-controls">
          <button class="inv-btn minus" onclick="adjustStock(${item.id}, -10)">−10</button>
          <input type="number" value="${item.stock}" min="0"
            onchange="setStock(${item.id}, this.value)" />
          <button class="inv-btn plus" onclick="adjustStock(${item.id}, 10)">+10</button>
        </div>
        <span class="stock-status-badge status-${statusLabel}">
          ${statusLabel === 'ok' ? '✓ In Stock' : statusLabel === 'low' ? '⚠ Low Stock' : '✗ Out of Stock'}
        </span>
      `;
      grid.appendChild(card);
    });
}

function filterInventory(val) { renderInventoryGrid(val); }

async function adjustStock(itemId, delta) {
  const item = State.menuItems.find(m => m.id === itemId);
  if (!item) return;
  const newStock = Math.max(0, item.stock + delta);
  await setStock(itemId, newStock);
}

async function setStock(itemId, newStock) {
  const stock = Math.max(0, parseInt(newStock) || 0);
  try {
    await API.menu.updateStock(itemId, stock);
    const item = State.menuItems.find(m => m.id === itemId);
    if (item) item.stock = stock;
    renderInventoryGrid(document.getElementById('inventorySearch').value);
    renderMenu(document.getElementById('menuSearch').value);
    toast('Stock updated', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

function openAddItemModal() { document.getElementById('addItemModal').classList.remove('hidden'); }

async function addMenuItem() {
  const name = document.getElementById('newItemName').value.trim();
  const price = parseFloat(document.getElementById('newItemPrice').value);
  const category = document.getElementById('newItemCategory').value;
  const stock = parseInt(document.getElementById('newItemStock').value) || 0;

  if (!name || !price) return toast('Name and price required', 'warn');

  try {
    await API.menu.addItem({ name, price, category, stock });
    toast(`${name} added to menu`, 'success');
    closeModal('addItemModal');
    await loadMenu();
    renderInventoryGrid();
    renderMenu();
  } catch (err) { toast(err.message, 'error'); }
}

function exportInventoryCSV() {
  const rows = [['Name', 'Category', 'Price', 'Stock', 'Min Stock', 'Status']];
  State.menuItems.filter(i => i.is_available).forEach(i => {
    rows.push([i.name, i.category, i.price, i.stock, i.min_stock,
      i.stock === 0 ? 'Out of Stock' : i.stock <= i.min_stock ? 'Low Stock' : 'In Stock']);
  });
  downloadCSV(rows, 'Inventory_Report');
}

// ══════════════════════════════════════
//  REPORTS
// ══════════════════════════════════════

async function loadReport() {
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;

  // Set defaults
  if (!from) {
    const d = new Date();
    d.setDate(1);
    document.getElementById('reportFrom').value = d.toISOString().slice(0, 10);
  }
  if (!to) {
    document.getElementById('reportTo').value = new Date().toISOString().slice(0, 10);
  }

  try {
    const params = {};
    if (from && to) { params.start_date = from; params.end_date = to; }
    const orders = await API.orders.history({ ...params, limit: 100 });
    renderReportTable(orders);
  } catch (err) { console.error('Reports:', err); }
}

function renderReportTable(orders) {
  const wrap = document.getElementById('reportTable');
  if (!orders || orders.length === 0) {
    wrap.innerHTML = '<div class="empty-state">No orders found for this period</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Bill No</th><th>Date</th><th>Time</th>
          <th>Table</th><th>Customer</th><th>Staff</th>
          <th>Subtotal</th><th>GST</th><th>Total</th><th>Payment</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(o => {
          const d = new Date(o.created_at);
          return `<tr>
            <td><strong>${o.bill_number}</strong></td>
            <td>${d.toLocaleDateString('en-IN')}</td>
            <td>${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${o.table_name}</td>
            <td>${o.customer_name || '—'}</td>
            <td>${o.staff_name}</td>
            <td>₹${o.subtotal}</td>
            <td>₹${o.gst_amount}</td>
            <td><strong>₹${o.total}</strong></td>
            <td><span class="stock-status-badge status-ok">${(o.payment_method || 'cash').toUpperCase()}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function exportReport(type) {
  let orders = [];
  try {
    if (type === 'daily') {
      const today = new Date().toISOString().slice(0, 10);
      orders = await API.orders.history({ date: today, limit: 500 });
    } else if (type === 'monthly') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      orders = await API.orders.history({ start_date: start, end_date: now.toISOString().slice(0, 10), limit: 500 });
    } else {
      orders = await API.orders.history({ limit: 9999 });
    }

    const rows = [['Bill No', 'Date', 'Table', 'Customer', 'Staff', 'Subtotal', 'GST', 'Total', 'Payment']];
    orders.forEach(o => {
      rows.push([o.bill_number, new Date(o.created_at).toLocaleDateString('en-IN'),
        o.table_name, o.customer_name || '', o.staff_name,
        o.subtotal, o.gst_amount, o.total, o.payment_method]);
    });
    downloadCSV(rows, `KadakJunction_${type}_report`);
  } catch (err) { toast(err.message, 'error'); }
}

// ══════════════════════════════════════
//  STAFF
// ══════════════════════════════════════

async function loadStaff() {
  try {
    const users = await API.users.getAll();
    const grid = document.getElementById('staffGrid');
    grid.innerHTML = '';
    users.forEach(u => {
      const card = document.createElement('div');
      card.className = `staff-card ${u.is_active ? '' : 'staff-inactive'}`;
      const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const lastLogin = u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never';
      card.innerHTML = `
        <div class="staff-avatar">${initials}</div>
        <div class="staff-info">
          <div class="staff-name">${u.name}</div>
          <div class="staff-username">@${u.username}</div>
          <span class="staff-role role-${u.role}">${u.role}</span>
          <div class="staff-meta">Last login: ${lastLogin}</div>
          ${!u.is_active ? '<div style="color:var(--danger);font-size:0.75rem;margin-top:4px">Inactive</div>' : ''}
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) { console.error('Staff:', err); }
}

function openAddStaffModal() { document.getElementById('addStaffModal').classList.remove('hidden'); }

async function addStaff() {
  const name = document.getElementById('newStaffName').value.trim();
  const username = document.getElementById('newStaffUsername').value.trim();
  const password = document.getElementById('newStaffPassword').value;
  const role = document.getElementById('newStaffRole').value;

  if (!name || !username || !password) return toast('All fields required', 'warn');

  try {
    await API.users.add({ name, username, password, role });
    toast(`${name} added successfully`, 'success');
    closeModal('addStaffModal');
    loadStaff();
  } catch (err) { toast(err.message, 'error'); }
}

// ══════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function toast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✗', warn: '⚠', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(100px)';
    el.style.transition = 'all 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ══════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════

document.addEventListener('keydown', e => {
  if (!State.user) {
    if (e.key === 'Enter') login();
    return;
  }
  // Number keys → select table
  if (!e.ctrlKey && !e.altKey && !e.shiftKey && document.activeElement.tagName !== 'INPUT') {
    if (e.key >= '1' && e.key <= '9') selectTable(parseInt(e.key));
    if (e.key === '0') selectTable(10);
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  }
});

// ══════════════════════════════════════
//  AUTO LOGIN (token check)
// ══════════════════════════════════════

window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('kj_token');
  if (token) {
    try {
      const user = await API.auth.me();
      State.user = user;
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');
      await initApp();
    } catch (_) {
      localStorage.removeItem('kj_token');
    }
  }
});

window.addEventListener('beforeunload', e => {
  if (State.user && State.currentOrderId) {
    e.preventDefault();
    e.returnValue = 'You have an active order open. Are you sure you want to leave?';
  }
});
