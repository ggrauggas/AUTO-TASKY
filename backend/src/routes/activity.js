const express = require('express');
const pool    = require('../config/db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

// GET /api/activity?limit=50
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit || '60'));
    const { rows } = await pool.query(`
      SELECT id, event_type, description, timestamp
      FROM system_events
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

module.exports = router;
