# 🔥 Zykaeats — Full Restaurant Website

A complete, production-ready restaurant ordering system with Razorpay payments, WhatsApp ordering, and an admin panel.

---

## 📁 Project Structure

```
zykaeats/
├── server.js              # Express backend (entry point)
├── package.json
├── .env.example           # Copy to .env and fill in keys
├── routes/
│   ├── menu.js            # GET/POST/PATCH/DELETE menu items
│   └── orders.js          # Create order, verify payment, list orders
├── data/
│   ├── menu.json          # Menu items (auto-updated via API)
│   └── orders.json        # Order store (replace with DB in production)
└── public/
    ├── index.html         # Customer-facing restaurant website
    └── admin.html         # Admin panel (menu + order management)
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd zykaeats
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your actual keys
```

### 3. Fill in your `.env`
```env
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
WHATSAPP_NUMBER=919876543210
ADMIN_PASSWORD=your_secure_password
PORT=3000
```

### 4. Start the server
```bash
# Development (auto-restart on change)
npm run dev

# Production
npm start
```

### 5. Open in browser
- **Website:**    http://localhost:3000
- **Admin panel:** http://localhost:3000/admin

---

## 💳 Razorpay Setup

1. Create account at https://razorpay.com
2. Go to **Settings → API Keys → Generate Key**
3. Copy `Key ID` and `Key Secret` into `.env`
4. For live payments, switch `rzp_test_` → `rzp_live_`

---

## 💬 WhatsApp Setup

Set `WHATSAPP_NUMBER` in `.env` to your number in international format (no `+` or spaces):
```
WHATSAPP_NUMBER=919876543210   # +91 98765 43210
```

Customers click "Order via WhatsApp" → opens wa.me with a pre-filled order message.

---

## 🔑 Admin Panel

Go to `/admin`, enter your `ADMIN_PASSWORD` from `.env`.

**Features:**
- Dashboard with daily revenue and order stats
- Full order list with status management
- Menu CRUD: add, edit, toggle availability, delete items

---

## 🌐 API Endpoints

### Public
| Method | Endpoint         | Description           |
|--------|------------------|-----------------------|
| GET    | `/api/config`    | Frontend configuration |
| GET    | `/api/menu`      | All menu items        |
| GET    | `/api/menu/:id`  | Single menu item      |
| POST   | `/api/orders/create`   | Create Razorpay order |
| POST   | `/api/orders/verify`   | Verify payment signature |
| POST   | `/api/orders/whatsapp` | Save WhatsApp order   |

### Admin (requires `x-admin-token` header)
| Method | Endpoint                     | Description         |
|--------|------------------------------|---------------------|
| GET    | `/api/orders`                | All orders          |
| GET    | `/api/orders/:id`            | Single order        |
| PATCH  | `/api/orders/:id/status`     | Update order status |
| POST   | `/api/menu`                  | Add menu item       |
| PATCH  | `/api/menu/:id`              | Update menu item    |
| DELETE | `/api/menu/:id`              | Delete menu item    |

---

## 🚢 Deployment (Render.com — Free Tier)

1. Push to GitHub
2. Create new **Web Service** on https://render.com
3. Set **Build Command:** `npm install`
4. Set **Start Command:** `npm start`
5. Add environment variables from `.env`
6. Deploy!

---

## 📦 Production Checklist

- [ ] Replace `data/orders.json` with PostgreSQL or MongoDB
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Use `rzp_live_` Razorpay keys for real payments
- [ ] Add SSL certificate (Render/Vercel handles this automatically)
- [ ] Set a strong `ADMIN_PASSWORD`
- [ ] Add proper domain in CORS config (`server.js`)
- [ ] Enable Razorpay webhook for payment failure recovery
- [ ] Set up WhatsApp Business API for automated confirmations

---

## 🛠 Tech Stack

| Layer      | Tech                          |
|------------|-------------------------------|
| Frontend   | HTML + CSS + Vanilla JS       |
| Backend    | Node.js + Express             |
| Payments   | Razorpay (UPI, cards, netbank)|
| WhatsApp   | wa.me deep link               |
| Data store | JSON files (dev) / DB (prod)  |
| Security   | Helmet, rate-limiting, HMAC   |
