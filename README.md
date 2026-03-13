# ☕ Kadak Junction — Full-Stack POS System v2.0

A complete **Point-of-Sale and Cafe Management System** built with Node.js, Express, SQLite, and vanilla JavaScript.

![Version](https://img.shields.io/badge/version-2.0.0-orange)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication with bcrypt password hashing
- Role-based access control (Manager / Cashier / Waiter)
- Rate limiting on login endpoint (20 req/15 min)
- Auto-logout on inactivity

### 🧾 POS / Billing
- Real-time multi-table billing (10 tables)
- Add/remove items with live stock deduction
- GST (18%) toggle
- Cash / UPI / Card payment methods
- Print-ready receipt generation
- Customer name & phone capture

### 🍳 Kitchen Order Ticket (KOT)
- Live kitchen view for all active orders
- Item-level status tracking: Pending → Preparing → Ready → Served
- Auto-refreshes every 15 seconds

### 📊 Analytics Dashboard
- Today's revenue, orders, avg order value
- Last 7-day revenue + orders chart (dual-axis)
- Hourly order heatmap
- Category revenue doughnut chart
- Payment method breakdown
- Top 5 selling items
- Low stock alerts

### 📦 Inventory Management
- Real-time stock tracking per item
- Low stock / out-of-stock visual indicators
- Quick +10/-10 stock adjustment
- Add new menu items
- Export inventory to CSV

### 📈 Reports
- Date range filtering
- Paginated order history table
- Export: Daily / Monthly / All-time CSV

### 👥 Staff Management
- View all staff with roles and last login
- Add new staff members (Manager only)
- Role management

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT + bcryptjs |
| Frontend | Vanilla JS + Chart.js |
| Fonts | Syne + DM Sans (Google Fonts) |
| Deployment | Render / Railway |

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/kadak-junction.git
cd kadak-junction

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and set a strong JWT_SECRET

# Start the server
npm start

# For development with auto-reload
npm run dev
```

Open `http://localhost:3000` in your browser.

### Default Credentials

| Username | Role | Password |
|----------|------|----------|
| manager | Manager | manager123 |
| cashier | Cashier | cash123 |
| waiter1 | Waiter | waiter123 |

> ⚠️ Change all passwords in production!

---

## 🗂️ Project Structure

```
kadak-junction/
├── backend/
│   ├── server.js          # Express app entry point
│   ├── db/
│   │   └── database.js    # SQLite init + seeding
│   ├── middleware/
│   │   └── auth.js        # JWT middleware + role guard
│   └── routes/
│       ├── auth.js        # Login/logout/me
│       ├── menu.js        # Menu items + stock
│       ├── orders.js      # Full order lifecycle
│       ├── analytics.js   # Dashboard + reports
│       └── management.js  # Tables + users
├── frontend/
│   ├── index.html         # Single-page app shell
│   ├── css/
│   │   └── style.css      # Complete design system
│   └── js/
│       ├── api.js         # API client layer
│       └── app.js         # App logic + state
├── data/                  # SQLite DB (auto-created)
├── .env
└── package.json
```

---

## 🌐 Deployment on Render

1. Push code to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add environment variables:
   - `JWT_SECRET` → a random 32-char string
   - `NODE_ENV` → `production`
5. Deploy!

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with username/password/role |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders/active` | All open orders |
| GET | `/api/orders/table/:id` | Open order for table |
| POST | `/api/orders` | Create new order |
| POST | `/api/orders/:id/items` | Add items to order |
| POST | `/api/orders/:id/checkout` | Finalize & close order |
| PUT | `/api/orders/:id/kot` | Update KOT item status |
| GET | `/api/orders/history` | Order history with filters |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | Full dashboard data |
| GET | `/api/analytics/monthly` | Monthly report |
| GET | `/api/analytics/staff` | Staff performance |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1–9`, `0` | Select Table 1–10 |
| `Escape` | Close modal |
| `Enter` (login screen) | Login |

---

## 📝 License

MIT — feel free to use this project for learning and portfolio purposes.
