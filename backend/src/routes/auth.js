require('dotenv').config();
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../config/db');
const { authenticate, blacklistToken } = require('../middleware/authenticate');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, pin } = req.body;
  if (!username || !pin) {
    return res.status(400).json({ error: true, message: 'username y pin requeridos.' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username=$1 AND active=true', [username]
    );
    if (!rows.length) {
      return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Credenciales incorrectas.' });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(String(pin), user.pin_hash);
    if (!valid) {
      return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Credenciales incorrectas.' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  blacklistToken(req.token);
  res.json({ message: 'Sesión cerrada.' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, role, created_at FROM users WHERE id=$1', [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: true, message: 'Usuario no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
