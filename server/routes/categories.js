const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

router.use(auth);

router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT id, name, color FROM categories WHERE user_id = ? ORDER BY created_at ASC'
  ).all(req.user.id);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Введите название' });

  const { lastInsertRowid: id } = db.prepare(
    'INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)'
  ).run(req.user.id, name.trim(), color || '#6c63ff');

  res.json({ id, name: name.trim(), color: color || '#6c63ff' });
});

router.delete('/:id', (req, res) => {
  const { changes } = db.prepare(
    'DELETE FROM categories WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.user.id);

  if (!changes) return res.status(404).json({ error: 'Категория не найдена' });
  res.json({ ok: true });
});

module.exports = router;
