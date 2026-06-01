const express  = require('express');
const bcrypt   = require('bcrypt');
const pool     = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// GET /api/users
router.get('/', async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query  = 'SELECT id, username, role, active, created_at FROM users ORDER BY id';
      params = [];
    } else {
      query  = 'SELECT id, username, role, active, created_at FROM users WHERE id=$1';
      params = [req.user.id];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, role, active, created_at FROM users WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: true, message: 'Usuario no encontrado.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

// POST /api/users  (admin only)
router.post('/', authorize('admin'), async (req, res) => {
  const { username, pin, role } = req.body;
  if (!username || !pin || !role) {
    return res.status(400).json({ error: true, message: 'username, pin y role requeridos.' });
  }
  if (!/^\d{4}$/.test(String(pin))) {
    return res.status(400).json({ error: true, message: 'El PIN debe ser exactamente 4 dígitos.' });
  }
  const validRoles = ['peon_almacen', 'jefe_zona', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: true, message: 'Rol inválido.' });
  }
  try {
    const hash = await bcrypt.hash(String(pin), 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, pin_hash, role) VALUES ($1,$2,$3) RETURNING id, username, role, active, created_at',
      [username, hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: true, message: 'Nombre de usuario ya existe.' });
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/users/:id  (admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  const { username, pin, role, active } = req.body;
  try {
    const { rows: current } = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!current.length) return res.status(404).json({ error: true, message: 'Usuario no encontrado.' });

    const u = current[0];
    let newHash = u.pin_hash;
    if (pin !== undefined) {
      if (!/^\d{4}$/.test(String(pin))) {
        return res.status(400).json({ error: true, message: 'El PIN debe ser exactamente 4 dígitos.' });
      }
      newHash = await bcrypt.hash(String(pin), 10);
    }
    const { rows } = await pool.query(
      `UPDATE users SET username=COALESCE($1,username), pin_hash=$2,
       role=COALESCE($3,role), active=COALESCE($4,active)
       WHERE id=$5 RETURNING id, username, role, active, created_at`,
      [username ?? u.username, newHash, role ?? u.role, active ?? u.active, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: true, message: 'Nombre de usuario ya existe.' });
    res.status(500).json({ error: true, message: err.message });
  }
});

// DELETE /api/users/:id  (admin only — soft delete)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE users SET active=false WHERE id=$1 RETURNING id', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: true, message: 'Usuario no encontrado.' });
    res.json({ message: 'Usuario desactivado.' });
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

module.exports = router;
