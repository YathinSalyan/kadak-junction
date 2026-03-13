// ═══════════════════════════════════════
//  KADAK JUNCTION — API Layer
// ═══════════════════════════════════════

const API = {
  baseURL: '/api',

  // Get stored token
  token() { return localStorage.getItem('kj_token'); },

  // Common headers
  headers() {
    const h = { 'Content-Type': 'application/json' };
    const t = this.token();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  },

  // Generic request
  async request(method, path, body = null) {
    const opts = { method, headers: this.headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.baseURL + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get: (path) => API.request('GET', path),
  post: (path, body) => API.request('POST', path, body),
  put: (path, body) => API.request('PUT', path, body),
  delete: (path) => API.request('DELETE', path),

  // AUTH
  auth: {
    login: (data) => API.post('/auth/login', data),
    logout: () => API.post('/auth/logout'),
    me: () => API.get('/auth/me'),
  },

  // MENU
  menu: {
    getAll: () => API.get('/menu'),
    updateStock: (id, stock) => API.put(`/menu/${id}/stock`, { stock }),
    updatePrice: (id, price) => API.put(`/menu/${id}/price`, { price }),
    addItem: (data) => API.post('/menu', data),
    removeItem: (id) => API.delete(`/menu/${id}`),
  },

  // ORDERS
  orders: {
    getActive: () => API.get('/orders/active'),
    getByTable: (tableId) => API.get(`/orders/table/${tableId}`),
    create: (data) => API.post('/orders', data),
    addItems: (orderId, items) => API.post(`/orders/${orderId}/items`, { items }),
    updateKOT: (orderId, item_id, status) => API.put(`/orders/${orderId}/kot`, { item_id, status }),
    checkout: (orderId, data) => API.post(`/orders/${orderId}/checkout`, data),
    removeItem: (orderId, itemId) => API.delete(`/orders/${orderId}/items/${itemId}`),
    history: (params = {}) => API.get('/orders/history?' + new URLSearchParams(params)),
  },

  // ANALYTICS
  analytics: {
    dashboard: () => API.get('/analytics/dashboard'),
    monthly: (year, month) => API.get(`/analytics/monthly?year=${year}&month=${month}`),
    staff: () => API.get('/analytics/staff'),
  },

  // MANAGEMENT
  tables: () => API.get('/tables'),
  users: {
    getAll: () => API.get('/users'),
    add: (data) => API.post('/users', data),
    update: (id, data) => API.put(`/users/${id}`, data),
  },
};
