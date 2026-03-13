const knex = require('knex');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = knex({
  client: 'sqlite3',
  connection: { filename: path.join(dataDir, 'kadak.db') },
  useNullAsDefault: true,
  pool: { min: 1, max: 1 }
});

async function initializeDatabase() {
  const hasUsers = await db.schema.hasTable('users');
  if (!hasUsers) {
    await db.schema.createTable('users', t => {
      t.increments('id').primary();
      t.string('username').unique().notNullable();
      t.string('name').notNullable();
      t.string('password_hash').notNullable();
      t.string('role').notNullable();
      t.integer('is_active').defaultTo(1);
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('last_login');
    });
  }

  const hasMenu = await db.schema.hasTable('menu_items');
  if (!hasMenu) {
    await db.schema.createTable('menu_items', t => {
      t.increments('id').primary();
      t.string('name').unique().notNullable();
      t.float('price').notNullable();
      t.string('category').notNullable();
      t.integer('stock').defaultTo(0);
      t.integer('min_stock').defaultTo(10);
      t.integer('is_available').defaultTo(1);
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  const hasTables = await db.schema.hasTable('tables');
  if (!hasTables) {
    await db.schema.createTable('tables', t => {
      t.integer('id').primary();
      t.string('name').notNullable();
      t.integer('capacity').defaultTo(4);
      t.string('status').defaultTo('available');
    });
  }

  const hasOrders = await db.schema.hasTable('orders');
  if (!hasOrders) {
    await db.schema.createTable('orders', t => {
      t.increments('id').primary();
      t.string('bill_number').unique().notNullable();
      t.integer('table_id');
      t.integer('staff_id');
      t.string('customer_name');
      t.string('customer_phone');
      t.float('subtotal').defaultTo(0);
      t.float('gst_amount').defaultTo(0);
      t.float('total').defaultTo(0);
      t.string('payment_method').defaultTo('cash');
      t.string('payment_status').defaultTo('paid');
      t.string('status').defaultTo('open');
      t.string('notes');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('closed_at');
    });
  }

  const hasOrderItems = await db.schema.hasTable('order_items');
  if (!hasOrderItems) {
    await db.schema.createTable('order_items', t => {
      t.increments('id').primary();
      t.integer('order_id');
      t.integer('menu_item_id');
      t.string('item_name').notNullable();
      t.float('item_price').notNullable();
      t.integer('quantity').notNullable();
      t.string('kot_status').defaultTo('pending');
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  const hasLog = await db.schema.hasTable('activity_log');
  if (!hasLog) {
    await db.schema.createTable('activity_log', t => {
      t.increments('id').primary();
      t.integer('user_id');
      t.string('action').notNullable();
      t.string('details');
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  // Seed users
  const userCount = await db('users').count('id as count').first();
  if (!userCount.count) {
    const users = [
      // { username: 'yathin', name: 'Yathin',  password: 'yathin123', role: 'Manager' },
      { username: 'manager', name: 'Manager',  password: 'manager123', role: 'Manager' },
      { username: 'admin',   name: 'Admin',    password: 'admin123',   role: 'Manager' },
      { username: 'cashier', name: 'Cashier',  password: 'cash123',    role: 'Cashier' },
      { username: 'waiter1', name: 'Waiter 1', password: 'waiter123',  role: 'Waiter'  },
      { username: 'waiter2', name: 'Waiter 2', password: 'waiter123',  role: 'Waiter'  },
    ];
    for (const u of users) {
      await db('users').insert({ username: u.username, name: u.name, password_hash: bcrypt.hashSync(u.password, 10), role: u.role });
    }
    console.log('✅ Users seeded');
  }

  // Seed menu
  const itemCount = await db('menu_items').count('id as count').first();
  if (!itemCount.count) {
    await db('menu_items').insert([
      { name: 'Kadak Chai',   price: 10, category: 'Beverages', stock: 200, min_stock: 20 },
      { name: 'Masala Chai',  price: 15, category: 'Beverages', stock: 150, min_stock: 20 },
      { name: 'Ginger Chai',  price: 15, category: 'Beverages', stock: 100, min_stock: 20 },
      { name: 'Green Tea',    price: 20, category: 'Beverages', stock: 80,  min_stock: 15 },
      { name: 'Black Coffee', price: 25, category: 'Beverages', stock: 100, min_stock: 15 },
      { name: 'Cappuccino',   price: 40, category: 'Beverages', stock: 50,  min_stock: 10 },
      { name: 'Cold Coffee',  price: 45, category: 'Beverages', stock: 60,  min_stock: 10 },
      { name: 'Lassi',        price: 30, category: 'Beverages', stock: 70,  min_stock: 10 },
      { name: 'Buttermilk',   price: 15, category: 'Beverages', stock: 80,  min_stock: 15 },
      { name: 'Lemonade',     price: 20, category: 'Beverages', stock: 90,  min_stock: 15 },
      { name: 'Biscuits',     price: 10, category: 'Snacks',    stock: 200, min_stock: 20 },
      { name: 'Samosa',       price: 12, category: 'Snacks',    stock: 50,  min_stock: 10 },
      { name: 'Vada Pav',     price: 15, category: 'Snacks',    stock: 30,  min_stock: 8  },
      { name: 'Pakoda',       price: 18, category: 'Snacks',    stock: 40,  min_stock: 10 },
      { name: 'Toast',        price: 20, category: 'Snacks',    stock: 25,  min_stock: 5  },
      { name: 'Sandwich',     price: 25, category: 'Snacks',    stock: 20,  min_stock: 5  },
      { name: 'Burger',       price: 40, category: 'Snacks',    stock: 15,  min_stock: 5  },
      { name: 'Maggi',        price: 30, category: 'Snacks',    stock: 35,  min_stock: 8  },
      { name: 'Poha',         price: 25, category: 'Snacks',    stock: 40,  min_stock: 8  },
      { name: 'Upma',         price: 30, category: 'Snacks',    stock: 30,  min_stock: 8  },
    ]);
    console.log('✅ Menu seeded');
  }

  // Seed tables
  const tableCount = await db('tables').count('id as count').first();
  if (!tableCount.count) {
    await db('tables').insert(Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, name: `Table ${i + 1}`, capacity: i < 4 ? 2 : i < 8 ? 4 : 6
    })));
    console.log('✅ Tables seeded');
  }

  console.log('✅ Database initialized');
}

module.exports = { db, initializeDatabase };
