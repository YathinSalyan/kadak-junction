const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: 'All fields required' });
    const user = await db('users').where({ username: username.toLowerCase(), is_active: 1 }).first();
    if (!user || user.role !== role) return res.status(401).json({ error: 'Invalid credentials' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    await db('users').where({ id: user.id }).update({ last_login: new Date().toISOString() });
    await db('activity_log').insert({ user_id: user.id, action: 'LOGIN', details: `Role: ${role}` });
    const token = jwt.sign({ id: user.id, username: user.username, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').select('id','username','name','role','last_login').where({ id: req.user.id }).first();
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await db('activity_log').insert({ user_id: req.user.id, action: 'LOGOUT' });
    res.json({ message: 'Logged out' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
