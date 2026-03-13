const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const items = await db('menu_items').where({ is_available: 1 }).orderBy(['category','name']);
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
    res.json({ items, grouped });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/stock', authenticateToken, requireRole('Manager','Cashier'), async (req, res) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) return res.status(400).json({ error: 'Valid stock required' });
    await db('menu_items').where({ id: req.params.id }).update({ stock: Math.floor(stock) });
    res.json({ message: 'Stock updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/price', authenticateToken, requireRole('Manager'), async (req, res) => {
  try {
    const { price } = req.body;
    if (!price || price <= 0) return res.status(400).json({ error: 'Valid price required' });
    await db('menu_items').where({ id: req.params.id }).update({ price });
    res.json({ message: 'Price updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, requireRole('Manager'), async (req, res) => {
  try {
    const { name, price, category, stock, min_stock } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Name, price and category required' });
    const [id] = await db('menu_items').insert({ name, price, category, stock: stock || 0, min_stock: min_stock || 10 });
    res.status(201).json({ id, message: 'Item added' });
  } catch (err) { res.status(400).json({ error: 'Item with this name already exists' }); }
});

router.delete('/:id', authenticateToken, requireRole('Manager'), async (req, res) => {
  try {
    await db('menu_items').where({ id: req.params.id }).update({ is_available: 0 });
    res.json({ message: 'Item removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
