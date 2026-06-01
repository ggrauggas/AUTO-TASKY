const express   = require('express');
const pool      = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

const SELECT = `
  SELECT m.*,
    mi.name AS input_material_name, mi.unit AS input_material_unit,
    mo.name AS output_material_name, mo.unit AS output_material_unit
  FROM machines m
  LEFT JOIN materials mi ON m.input_material_id  = mi.id
  LEFT JOIN materials mo ON m.output_material_id = mo.id
`;

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(SELECT + ' ORDER BY m.name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(SELECT + ' WHERE m.id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: true, message: 'Máquina no encontrada.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  const { name, type, input_material_id, output_material_id, processing_time_sec } = req.body;
  if (!name) return res.status(400).json({ error: true, message: 'name requerido.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO machines (name, type, input_material_id, output_material_id, processing_time_sec)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, type || null, input_material_id || null, output_material_id || null, processing_time_sec || 60]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: true, message: 'Máquina ya existe.' });
    res.status(500).json({ error: true, message: err.message });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  const { name, type, input_material_id, output_material_id, processing_time_sec, active } = req.body;
  try {
    const { rows: cur } = await pool.query('SELECT * FROM machines WHERE id=$1', [req.params.id]);
    if (!cur.length) return res.status(404).json({ error: true, message: 'Máquina no encontrada.' });
    const c = cur[0];
    const { rows } = await pool.query(
      `UPDATE machines SET name=$1, type=$2, input_material_id=$3, output_material_id=$4,
       processing_time_sec=$5, active=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [
        name ?? c.name, type ?? c.type,
        input_material_id  ?? c.input_material_id,
        output_material_id ?? c.output_material_id,
        processing_time_sec ?? c.processing_time_sec,
        active ?? c.active,
        req.params.id
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: true, message: 'Máquina ya existe.' });
    res.status(500).json({ error: true, message: err.message });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE machines SET active=false WHERE id=$1 RETURNING id', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: true, message: 'Máquina no encontrada.' });
    res.json({ message: 'Máquina desactivada.' });
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

module.exports = router;
