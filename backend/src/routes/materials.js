const express   = require('express');
const pool      = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM materials ORDER BY name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM materials WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: true, message: 'Material no encontrado.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  const { name, unit, description } = req.body;
  if (!name || !unit) return res.status(400).json({ error: true, message: 'name y unit requeridos.' });
  const validUnits = ['kg', 'unidades', 'litros'];
  if (!validUnits.includes(unit)) return res.status(400).json({ error: true, message: 'Unidad inválida.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO materials (name, unit, description) VALUES ($1,$2,$3) RETURNING *',
      [name, unit, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: true, message: 'Material ya existe.' });
    res.status(500).json({ error: true, message: err.message });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  const { name, unit, description } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE materials SET name=COALESCE($1,name), unit=COALESCE($2,unit), description=COALESCE($3,description)
       WHERE id=$4 RETURNING *`,
      [name, unit, description, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: true, message: 'Material no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: true, message: 'Material ya existe.' });
    res.status(500).json({ error: true, message: err.message });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM materials WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: true, message: 'Material no encontrado.' });
    res.json({ message: 'Material eliminado.' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: true, message: 'Material en uso, no se puede eliminar.' });
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
