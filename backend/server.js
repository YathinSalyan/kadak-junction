require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: 'Too many attempts. Try again in 15 minutes.' } });

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api', require('./routes/management'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.0' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

// Init DB then start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n☕ Kadak Junction v2.0 running on http://localhost:${PORT}`);
    console.log(`📊 Open in browser: http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

module.exports = app;
