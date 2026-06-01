const express   = require('express');
const pool      = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

const VALID_TYPES = ['almacen_slot', 'entrada_maquina', 'salida_maquina', 'trituradora'];

router.get('/', async (req, res) => {
  try {
    let query = `SELECT l.*, m.name AS machine_name FROM locations l
                 LEFT JOIN machines m ON l.machine_id = m.id`;
    const params = [];
    if (req.query.type) {
      query += ' WHERE l.type=$1';
      params.push(req.query.type);
    }
    query += ' ORDER BY l.name';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, m.name AS machine_name FROM locations l
       LEFT JOIN machines m ON l.machine_id = m.id WHERE l.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: true, message: 'Ubicación no encontrada.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  const { name, type, machine_id, description } = req.body;
  if (!name || !type) return res.status(400).json({ error: true, message: 'name y type requeridos.' });
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: true, message: 'Tipo inválido.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO locations (name, type, machine_id, description) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, type, machine_id || null, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: true, message: 'Ubicación ya existe.' });
    res.status(500).json({ error: true, message: err.message });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  const { name, type, machine_id, description, active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE locations SET name=COALESCE($1,name), type=COALESCE($2,type),
       machine_id=COALESCE($3,machine_id), description=COALESCE($4,description), active=COALESCE($5,active)
       WHERE id=$6 RETURNING *`,
      [name, type, machine_id, description, active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: true, message: 'Ubicación no encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: true, message: 'Ubicación ya existe.' });
    res.status(500).json({ error: true, message: err.message });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE locations SET active=false WHERE id=$1 RETURNING id', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: true, message: 'Ubicación no encontrada.' });
    res.json({ message: 'Ubicación desactivada.' });
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

module.exports = router;
