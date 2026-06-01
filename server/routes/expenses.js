const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

router.use(auth);

router.get('/', (req, res) => {
  const { month } = req.query;
  let query = `
    SELECT e.id, e.amount, e.date, e.description,
           c.id as category_id, c.name as category_name, c.color as category_color
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = ?
  `;
  const params = [req.user.id];

  if (month) {
    query += ` AND e.date LIKE ?`;
    params.push(`${month}%`);
  }

  query += ` ORDER BY e.date DESC, e.created_at DESC`;
  const rows = db.prepare(query).all(...params);

  res.json(rows.map(r => ({
    id: r.id,
    amount: r.amount,
    date: r.date,
    description: r.description,
    category: { id: r.category_id, name: r.category_name, color: r.category_color }
  })));
});

router.post('/', (req, res) => {
  const { amount, category_id, date, description } = req.body;
  if (!amount || !category_id || !date) {
    return res.status(400).json({ error: 'Заполните обязательные поля' });
  }

  const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
    .get(category_id, req.user.id);
  if (!cat) return res.status(400).json({ error: 'Категория не найдена' });

  const { lastInsertRowid: id } = db.prepare(
    'INSERT INTO expenses (user_id, category_id, amount, date, description) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, category_id, Number(amount), date, description || null);

  res.json({ id, amount: Number(amount), category_id, date, description });
});

router.delete('/:id', (req, res) => {
  const { changes } = db.prepare(
    'DELETE FROM expenses WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.user.id);

  if (!changes) return res.status(404).json({ error: 'Расход не найден' });
  res.json({ ok: true });
});

module.exports = router;
