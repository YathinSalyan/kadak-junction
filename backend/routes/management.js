const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/tables', authenticateToken, async (req, res) => {
  try {
    const tables = await db('tables').orderBy('id');
    for (const t of tables) {
      const order = await db('orders').where({ table_id: t.id, status: 'open' }).first();
      t.order_id = order?.id || null;
      t.current_total = order?.total || null;
      t.item_count = order ? (await db('order_items').where({ order_id: order.id }).sum('quantity as s').first()).s || 0 : 0;
    }
    res.json(tables);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', authenticateToken, requireRole('Manager'), async (req, res) => {
  try {
    const users = await db('users').select('id','username','name','role','is_active','last_login','created_at').orderBy(['role','name']);
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', authenticateToken, requireRole('Manager'), async (req, res) => {
  try {
    const { username, name, password, role } = req.body;
    if (!username || !name || !password || !role) return res.status(400).json({ error: 'All fields required' });
    const [id] = await db('users').insert({ username: username.toLowerCase(), name, password_hash: bcrypt.hashSync(password, 10), role });
    res.status(201).json({ id, message: 'Staff added' });
  } catch (err) { res.status(400).json({ error: 'Username already exists' }); }
});

router.put('/users/:id', authenticateToken, requireRole('Manager'), async (req, res) => {
  try {
    const { name, role, is_active, password } = req.body;
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const update = { name: name || user.name, role: role || user.role, is_active: is_active !== undefined ? is_active : user.is_active };
    if (password) update.password_hash = bcrypt.hashSync(password, 10);
    await db('users').where({ id: user.id }).update(update);
    res.json({ message: 'User updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
