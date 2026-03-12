// server.js  —  Zykaeats Express Backend
require('dotenv').config();

const express     = require('express');
const path        = require('path');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

const menuRouter   = require('./routes/menu');
const ordersRouter = require('./routes/orders');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com', 'https://fonts.googleapis.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:       ["'self'", 'https://fonts.gstatic.com'],
      connectSrc:    ["'self'", 'https://api.razorpay.com'],
      frameSrc:      ['https://api.razorpay.com'],
      imgSrc:        ["'self'", 'data:', 'https:'],
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://zykaeats.in', 'https://www.zykaeats.in']
    : '*',
}));

// ── Rate limiting ───────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  message: { error: 'Too many requests, please try again later' },
});

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 20,
  message: { error: 'Too many orders from this IP, please try again later' },
});

// ── Body parsing ─────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Serve static frontend ────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
}));

// ── Health check ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV,
    razorpay:  !!process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('XXXX'),
  });
});

// ── API config (public, safe to expose) ─────────────────
app.get('/api/config', (req, res) => {
  res.json({
    restaurantName:      process.env.RESTAURANT_NAME || 'Zykaeats Cloud Kitchen',
    whatsappNumber:      process.env.WHATSAPP_NUMBER || '919876543210',
    razorpayKeyId:       process.env.RAZORPAY_KEY_ID || '',
    freeDeliveryAt:      Number(process.env.FREE_DELIVERY_THRESHOLD) || 299,
    deliveryFee:         Number(process.env.DELIVERY_FEE) || 29,
    gstRate:             Number(process.env.GST_RATE) || 0.05,
    razorpayEnabled:     !!(process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('XXXX')),
  });
});

// ── API routes ───────────────────────────────────────────
app.use('/api/menu',   apiLimiter, menuRouter);
app.use('/api/orders', orderLimiter, ordersRouter);

// ── Admin panel (serves admin.html for /admin path) ──────
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── SPA fallback ─────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ─────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║  🔥 Zykaeats Server Running          ║
  ║  http://localhost:${PORT}               ║
  ║  ENV: ${(process.env.NODE_ENV || 'development').padEnd(29)}║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = app;
