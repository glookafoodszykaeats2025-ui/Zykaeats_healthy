// routes/orders.js  —  Razorpay create + verify, order store
const express  = require('express');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const Razorpay = require('razorpay');
const { v4: uuid } = require('uuid');

const router = express.Router();
const ORDERS_FILE = path.join(__dirname, '../data/orders.json');

// ── helpers ────────────────────────────────────────────
function readOrders()       { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); }
function writeOrders(data)  { fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2)); }

function adminOnly(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  next();
}

// ── Razorpay instance (lazy – only if keys are present) ─
function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('XXXX')) {
    return null;
  }
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// ── validate incoming cart items ───────────────────────
function validateCart(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Cart is empty';
  for (const i of items) {
    if (!i.id || !i.name || typeof i.price !== 'number' || typeof i.qty !== 'number') {
      return 'Invalid cart item: ' + JSON.stringify(i);
    }
    if (i.qty < 1 || i.qty > 50) return `Invalid quantity for ${i.name}`;
    if (i.price < 0 || i.price > 5000) return `Invalid price for ${i.name}`;
  }
  return null;
}

// ── POST /api/orders/create ────────────────────────────
router.post('/create', async (req, res) => {
  try {
    const { items, customer, subtotal, deliveryFee, gst, total } = req.body;

    const cartError = validateCart(items);
    if (cartError) return res.status(400).json({ error: cartError });

    if (!customer?.name || !customer?.phone || !customer?.address) {
      return res.status(400).json({ error: 'Customer name, phone, and address are required' });
    }

    const orderId    = 'ZKE-' + Date.now().toString(36).toUpperCase();
    const amountPaise = Math.round(Number(total) * 100);

    if (amountPaise < 100) return res.status(400).json({ error: 'Order total too low' });

    // ── Try Razorpay ───────────────────────────────────
    const rzp = getRazorpay();
    let razorpayOrderId = null;

    if (rzp) {
      const rzpOrder = await rzp.orders.create({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  orderId,
        notes: {
          customerName:  customer.name,
          customerPhone: customer.phone,
          address:       customer.address,
        },
      });
      razorpayOrderId = rzpOrder.id;
    }

    // ── Persist order ──────────────────────────────────
    const order = {
      orderId,
      razorpayOrderId,
      status:        'pending',
      paymentStatus: 'unpaid',
      items,
      customer,
      subtotal:    Number(subtotal),
      deliveryFee: Number(deliveryFee),
      gst:         Number(gst),
      total:       Number(total),
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    };

    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);

    res.json({
      orderId,
      razorpayOrderId,
      amount:          amountPaise,
      currency:        'INR',
      razorpayKeyId:   process.env.RAZORPAY_KEY_ID,
    });

  } catch (err) {
    console.error('create-order error:', err);
    res.status(500).json({ error: err.message || 'Failed to create order' });
  }
});

// ── POST /api/orders/verify ────────────────────────────
router.post('/verify', (req, res) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!orderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    // ── Signature verification ─────────────────────────
    const body     = razorpayOrderId + '|' + razorpayPaymentId;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (expected !== razorpaySignature) {
      // Update order to failed
      const orders = readOrders();
      const idx    = orders.findIndex(o => o.orderId === orderId);
      if (idx !== -1) {
        orders[idx].paymentStatus = 'failed';
        orders[idx].updatedAt     = new Date().toISOString();
        writeOrders(orders);
      }
      return res.status(400).json({ error: 'Payment signature mismatch' });
    }

    // ── Mark paid ──────────────────────────────────────
    const orders = readOrders();
    const idx    = orders.findIndex(o => o.orderId === orderId);
    if (idx !== -1) {
      orders[idx].paymentStatus   = 'paid';
      orders[idx].razorpayPaymentId = razorpayPaymentId;
      orders[idx].status          = 'confirmed';
      orders[idx].updatedAt       = new Date().toISOString();
      writeOrders(orders);
    }

    res.json({ success: true, orderId, paymentId: razorpayPaymentId });

  } catch (err) {
    console.error('verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── POST /api/orders/whatsapp ──────────────────────────
//   Save a WhatsApp order (no payment)
router.post('/whatsapp', (req, res) => {
  try {
    const { items, customer, subtotal, deliveryFee, gst, total } = req.body;

    const cartError = validateCart(items);
    if (cartError) return res.status(400).json({ error: cartError });

    const orderId = 'ZKW-' + Date.now().toString(36).toUpperCase();
    const order = {
      orderId,
      razorpayOrderId: null,
      status:        'pending',
      paymentStatus: 'whatsapp',
      items, customer,
      subtotal:    Number(subtotal),
      deliveryFee: Number(deliveryFee),
      gst:         Number(gst),
      total:       Number(total),
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    };

    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);

    res.json({ orderId });
  } catch (err) {
    console.error('whatsapp-order error:', err);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

// ── GET /api/orders  (admin) ───────────────────────────
router.get('/', adminOnly, (req, res) => {
  const orders = readOrders().reverse(); // newest first
  res.json({ orders, count: orders.length });
});

// ── GET /api/orders/:id  (admin) ──────────────────────
router.get('/:id', adminOnly, (req, res) => {
  const order = readOrders().find(o => o.orderId === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// ── PATCH /api/orders/:id/status  (admin) ─────────────
router.patch('/:id/status', adminOnly, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending','confirmed','preparing','ready','out_for_delivery','delivered','cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const orders = readOrders();
  const idx    = orders.findIndex(o => o.orderId === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  orders[idx].status    = status;
  orders[idx].updatedAt = new Date().toISOString();
  writeOrders(orders);
  res.json(orders[idx]);
});

module.exports = router;
