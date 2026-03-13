const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

async function generateBillNumber() {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const count = await db('orders').whereRaw("date(created_at) = date('now')").count('id as c').first();
  return `KJ-${date}-${String((count.c || 0) + 1).padStart(4,'0')}`;
}

router.get('/active', authenticateToken, async (req, res) => {
  try {
    const orders = await db('orders as o')
      .join('tables as t', 'o.table_id', 't.id')
      .join('users as u', 'o.staff_id', 'u.id')
      .select('o.*','t.name as table_name','u.name as staff_name')
      .where('o.status', 'open')
      .orderBy('o.created_at', 'desc');
    for (const order of orders) {
      order.items = await db('order_items').where({ order_id: order.id });
    }
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/table/:tableId', authenticateToken, async (req, res) => {
  try {
    const order = await db('orders as o')
      .join('users as u', 'o.staff_id', 'u.id')
      .select('o.*','u.name as staff_name')
      .where({ 'o.table_id': req.params.tableId, 'o.status': 'open' })
      .orderBy('o.created_at', 'desc').first();
    if (!order) return res.json(null);
    order.items = await db('order_items').where({ order_id: order.id });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { table_id, customer_name, customer_phone, items } = req.body;
    if (!table_id || !items?.length) return res.status(400).json({ error: 'Table and items required' });

    const existing = await db('orders').where({ table_id, status: 'open' }).first();
    if (existing) return res.status(400).json({ error: 'Table already has an open order', order_id: existing.id });

    const bill_number = await generateBillNumber();
    const [orderId] = await db('orders').insert({ bill_number, table_id, staff_id: req.user.id, customer_name: customer_name || null, customer_phone: customer_phone || null });

    for (const item of items) {
      const menuItem = await db('menu_items').where({ id: item.menu_item_id }).first();
      if (!menuItem) throw new Error(`Item not found`);
      if (menuItem.stock < item.quantity) throw new Error(`Insufficient stock for ${menuItem.name}`);
      await db('order_items').insert({ order_id: orderId, menu_item_id: item.menu_item_id, item_name: menuItem.name, item_price: menuItem.price, quantity: item.quantity });
      await db('menu_items').where({ id: item.menu_item_id }).decrement('stock', item.quantity);
    }

    await db('tables').where({ id: table_id }).update({ status: 'occupied' });
    res.status(201).json({ order_id: orderId, bill_number });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/:id/items', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'Items required' });
    const order = await db('orders').where({ id: req.params.id, status: 'open' }).first();
    if (!order) return res.status(404).json({ error: 'Open order not found' });

    for (const item of items) {
      const menuItem = await db('menu_items').where({ id: item.menu_item_id }).first();
      if (!menuItem || menuItem.stock < item.quantity) throw new Error(`Cannot add ${menuItem?.name || 'item'}`);
      const existing = await db('order_items').where({ order_id: order.id, menu_item_id: item.menu_item_id }).first();
      if (existing) {
        await db('order_items').where({ id: existing.id }).increment('quantity', item.quantity);
      } else {
        await db('order_items').insert({ order_id: order.id, menu_item_id: item.menu_item_id, item_name: menuItem.name, item_price: menuItem.price, quantity: item.quantity });
      }
      await db('menu_items').where({ id: item.menu_item_id }).decrement('stock', item.quantity);
    }
    res.json({ message: 'Items added' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id/kot', authenticateToken, async (req, res) => {
  try {
    const { item_id, status } = req.body;
    await db('order_items').where({ id: item_id, order_id: req.params.id }).update({ kot_status: status });
    res.json({ message: 'KOT updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/checkout', authenticateToken, async (req, res) => {
  try {
    const { gst_enabled, payment_method } = req.body;
    const order = await db('orders').where({ id: req.params.id, status: 'open' }).first();
    if (!order) return res.status(404).json({ error: 'Open order not found' });

    const items = await db('order_items').where({ order_id: order.id });
    const subtotal = items.reduce((s, i) => s + i.item_price * i.quantity, 0);
    const gst_amount = gst_enabled ? Math.round(subtotal * 0.18) : 0;
    const total = subtotal + gst_amount;

    await db('orders').where({ id: order.id }).update({ subtotal, gst_amount, total, payment_method: payment_method || 'cash', payment_status: 'paid', status: 'closed', closed_at: new Date().toISOString() });
    await db('tables').where({ id: order.table_id }).update({ status: 'available' });
    await db('activity_log').insert({ user_id: req.user.id, action: 'ORDER_CLOSED', details: `Bill ${order.bill_number} ₹${total}` });

    const fullOrder = await db('orders').where({ id: order.id }).first();
    res.json({ ...fullOrder, items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const item = await db('order_items').where({ id: req.params.itemId, order_id: req.params.id }).first();
    if (!item) return res.status(404).json({ error: 'Item not found' });
    await db('menu_items').where({ id: item.menu_item_id }).increment('stock', item.quantity);
    await db('order_items').where({ id: item.id }).delete();
    res.json({ message: 'Item removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/history', authenticateToken, requireRole('Manager','Cashier'), async (req, res) => {
  try {
    const { date, start_date, end_date, limit = 50 } = req.query;
    let q = db('orders as o').join('tables as t','o.table_id','t.id').join('users as u','o.staff_id','u.id')
      .select('o.*','t.name as table_name','u.name as staff_name')
      .where('o.status', 'closed').orderBy('o.closed_at','desc').limit(parseInt(limit));
    if (date) q = q.whereRaw("date(o.created_at) = ?", [date]);
    else if (start_date && end_date) q = q.whereRaw("date(o.created_at) BETWEEN ? AND ?", [start_date, end_date]);
    res.json(await q);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
