const express   = require('express');
const pool      = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

const SELECT = `
  SELECT i.*, l.name AS location_name, l.type AS location_type,
         m.name AS material_name, m.unit AS material_unit
  FROM inventory i
  JOIN locations l ON i.location_id = l.id
  JOIN materials m ON i.material_id = m.id
`;

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(SELECT + ' ORDER BY l.name, m.name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

router.get('/location/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(SELECT + ' WHERE i.location_id=$1 ORDER BY m.name', [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

// Ajuste manual de inventario (admin only)
router.put('/adjust', authorize('admin'), async (req, res) => {
  const { location_id, material_id, quantity } = req.body;
  if (!location_id || !material_id || quantity === undefined) {
    return res.status(400).json({ error: true, message: 'location_id, material_id y quantity requeridos.' });
  }
  if (quantity < 0) return res.status(400).json({ error: true, message: 'La cantidad no puede ser negativa.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO inventory (location_id, material_id, quantity)
       VALUES ($1,$2,$3)
       ON CONFLICT (location_id, material_id) DO UPDATE SET quantity=$3, updated_at=NOW()
       RETURNING *`,
      [location_id, material_id, quantity]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

module.exports = router;
