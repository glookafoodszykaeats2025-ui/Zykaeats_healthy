// routes/menu.js  —  CRUD for menu items
const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const { v4: uuid } = require('uuid');

const router   = express.Router();
const MENU_FILE = path.join(__dirname, '../data/menu.json');

// ── helpers ────────────────────────────────────────────
function readMenu()      { return JSON.parse(fs.readFileSync(MENU_FILE, 'utf8')); }
function writeMenu(data) { fs.writeFileSync(MENU_FILE, JSON.stringify(data, null, 2)); }

function adminOnly(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  next();
}

// ── GET /api/menu  (public) ─────────────────────────────
router.get('/', (req, res) => {
  const items = readMenu();
  res.json({ items });
});

// ── GET /api/menu/:id  (public) ─────────────────────────
router.get('/:id', (req, res) => {
  const item = readMenu().find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// ── POST /api/menu  (admin) ─────────────────────────────
router.post('/', adminOnly, (req, res) => {
  const { name, cat, emoji, desc, price, origPrice, badge, badgeLabel, available, sortOrder } = req.body;
  if (!name || !cat || !price) {
    return res.status(400).json({ error: 'name, cat and price are required' });
  }
  const items = readMenu();
  const newItem = {
    id: uuid().slice(0, 8),
    cat, emoji: emoji || '🍽',
    name, desc: desc || '',
    price: Number(price),
    origPrice: origPrice ? Number(origPrice) : null,
    badge: badge || null,
    badgeLabel: badgeLabel || null,
    available: available !== false,
    sortOrder: sortOrder || items.length + 1,
  };
  items.push(newItem);
  writeMenu(items);
  res.status(201).json(newItem);
});

// ── PATCH /api/menu/:id  (admin) ────────────────────────
router.patch('/:id', adminOnly, (req, res) => {
  const items = readMenu();
  const idx   = items.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });

  const allowed = ['name','cat','emoji','desc','price','origPrice','badge','badgeLabel','available','sortOrder'];
  allowed.forEach(k => {
    if (req.body[k] !== undefined) {
      items[idx][k] = k === 'price' || k === 'origPrice' || k === 'sortOrder'
        ? (req.body[k] === null ? null : Number(req.body[k]))
        : req.body[k];
    }
  });
  writeMenu(items);
  res.json(items[idx]);
});

// ── DELETE /api/menu/:id  (admin) ───────────────────────
router.delete('/:id', adminOnly, (req, res) => {
  const items   = readMenu();
  const updated = items.filter(m => m.id !== req.params.id);
  if (updated.length === items.length) return res.status(404).json({ error: 'Item not found' });
  writeMenu(updated);
  res.json({ success: true });
});

module.exports = router;
