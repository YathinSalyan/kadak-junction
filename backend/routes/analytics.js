const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/dashboard', authenticateToken, requireRole('Manager','Cashier'), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0,10);

    const todayStats = await db('orders').whereRaw("status='closed' AND date(created_at)=?", [today])
      .select(db.raw('COUNT(*) as total_orders, COALESCE(SUM(total),0) as total_revenue, COALESCE(AVG(total),0) as avg_order_value, COALESCE(SUM(gst_amount),0) as total_gst')).first();

    const monthStats = await db('orders').whereRaw("status='closed' AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')")
      .select(db.raw('COUNT(*) as total_orders, COALESCE(SUM(total),0) as total_revenue')).first();

    const activeOrdersRow = await db('orders').where({ status: 'open' }).count('id as count').first();
    const activeTablesRow = await db('tables').where({ status: 'occupied' }).count('id as count').first();

    const last7Days = await db('orders').whereRaw("status='closed' AND date(created_at) >= date('now','-6 days')")
      .select(db.raw("date(created_at) as date, COALESCE(SUM(total),0) as revenue, COUNT(*) as orders"))
      .groupByRaw("date(created_at)").orderBy('date','asc');

    const topItems = await db('order_items as oi').join('orders as o','oi.order_id','o.id')
      .whereRaw("o.status='closed' AND date(o.created_at)=?", [today])
      .select(db.raw('oi.item_name, SUM(oi.quantity) as qty, SUM(oi.item_price*oi.quantity) as revenue'))
      .groupBy('oi.item_name').orderBy('qty','desc').limit(5);

    const categoryRevenue = await db('order_items as oi').join('orders as o','oi.order_id','o.id').join('menu_items as mi','oi.menu_item_id','mi.id')
      .whereRaw("o.status='closed' AND date(o.created_at)=?", [today])
      .select(db.raw('mi.category, SUM(oi.item_price*oi.quantity) as revenue')).groupBy('mi.category');

    const hourlyBreakdown = await db('orders').whereRaw("status='closed' AND date(created_at)=?", [today])
      .select(db.raw("strftime('%H',created_at) as hour, COUNT(*) as orders, COALESCE(SUM(total),0) as revenue"))
      .groupByRaw("strftime('%H',created_at)").orderBy('hour');

    const paymentBreakdown = await db('orders').whereRaw("status='closed' AND date(created_at)=?", [today])
      .select(db.raw('payment_method, COUNT(*) as count, SUM(total) as total')).groupBy('payment_method');

    const lowStock = await db('menu_items').where({ is_available: 1 }).whereRaw('stock <= min_stock').select('name','stock','min_stock','category').orderBy('stock');

    res.json({
      today: todayStats, month: monthStats,
      active_orders: activeOrdersRow.count, active_tables: activeTablesRow.count,
      last_7_days: last7Days, top_items: topItems, category_revenue: categoryRevenue,
      hourly_breakdown: hourlyBreakdown, payment_breakdown: paymentBreakdown, low_stock_alerts: lowStock
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/monthly', authenticateToken, requireRole('Manager'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const period = year && month ? `${year}-${month.padStart(2,'0')}` : new Date().toISOString().slice(0,7);
    const summary = await db('orders').whereRaw("status='closed' AND strftime('%Y-%m',created_at)=?", [period])
      .select(db.raw('COUNT(*) as orders, SUM(total) as revenue, SUM(gst_amount) as gst, AVG(total) as avg_order')).first();
    const daily = await db('orders').whereRaw("status='closed' AND strftime('%Y-%m',created_at)=?", [period])
      .select(db.raw("date(created_at) as date, COUNT(*) as orders, SUM(total) as revenue")).groupByRaw("date(created_at)").orderBy('date');
    const topItems = await db('order_items as oi').join('orders as o','oi.order_id','o.id')
      .whereRaw("o.status='closed' AND strftime('%Y-%m',o.created_at)=?", [period])
      .select(db.raw('oi.item_name, SUM(oi.quantity) as qty, SUM(oi.item_price*oi.quantity) as revenue'))
      .groupBy('oi.item_name').orderBy('revenue','desc').limit(10);
    res.json({ period, summary, daily, top_items: topItems });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/staff', authenticateToken, requireRole('Manager'), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0,10);
    const perf = await db('users as u').leftJoin(db('orders').whereRaw("status='closed' AND date(created_at)=?", [today]).as('o'), 'u.id','o.staff_id')
      .where('u.is_active', 1)
      .select(db.raw('u.name, u.role, COUNT(o.id) as orders_today, COALESCE(SUM(o.total),0) as revenue_today'))
      .groupBy('u.id').orderBy('revenue_today','desc');
    res.json(perf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
