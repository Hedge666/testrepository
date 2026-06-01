const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'finance-secret-key-change-in-production';
const JWT_EXPIRES = '30d';

const DEFAULT_CATEGORIES = [
  { name: 'Еда', color: '#f59e0b' },
  { name: 'Транспорт', color: '#3b82f6' },
  { name: 'Развлечения', color: '#8b5cf6' },
  { name: 'Здоровье', color: '#10b981' },
  { name: 'Покупки', color: '#ef4444' },
];

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'Email уже зарегистрирован' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const { lastInsertRowid: userId } = db.prepare(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
  ).run(name, email, hash);

  const insertCat = db.prepare('INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)');
  DEFAULT_CATEGORIES.forEach(c => insertCat.run(userId, c.name, c.color));

  const token = jwt.sign({ id: userId, name, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: userId, name, email } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

module.exports = router;
