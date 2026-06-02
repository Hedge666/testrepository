const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'callcenter',
  user: 'admin',
  password: 'admin123',
});

// Поиск клиента по телефону или ФИО
app.get('/api/client', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Укажите номер телефона или ФИО' });

  try {
    const isPhone = /\d/.test(q);
    let clientResult;

    if (req.query.by_id) {
      clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [q]);
    } else if (isPhone) {
      const digits = q.replace(/\D/g, '');
      clientResult = await pool.query(
        "SELECT * FROM clients WHERE regexp_replace(phone, '[^0-9]', '', 'g') ILIKE $1",
        [`%${digits}%`]
      );
    } else {
      clientResult = await pool.query(
        'SELECT * FROM clients WHERE full_name ILIKE $1 ORDER BY full_name LIMIT 10',
        [`%${q}%`]
      );
    }

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    // Если нашли несколько — возвращаем список для выбора
    if (clientResult.rows.length > 1) {
      return res.json({ multiple: true, clients: clientResult.rows });
    }

    const client = clientResult.rows[0];
    const orders = await pool.query(
      `SELECT o.*,
        (SELECT status FROM order_statuses WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) AS current_status,
        (SELECT created_at FROM order_statuses WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) AS last_update
       FROM orders o WHERE o.client_id = $1 ORDER BY o.created_at DESC`,
      [client.id]
    );

    const calls = await pool.query(
      'SELECT * FROM calls WHERE client_id = $1 ORDER BY date DESC',
      [client.id]
    );

    res.json({ client, orders: orders.rows, calls: calls.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Детали заказа с цепочкой статусов
app.get('/api/order/:id', async (req, res) => {
  try {
    const order = await pool.query(
      `SELECT o.*, c.full_name, c.phone FROM orders o
       JOIN clients c ON c.id = o.client_id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const statuses = await pool.query(
      'SELECT * FROM order_statuses WHERE order_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({ order: order.rows[0], statuses: statuses.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Callcenter API: http://localhost:${PORT}`));
