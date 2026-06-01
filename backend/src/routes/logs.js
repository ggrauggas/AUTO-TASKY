const express = require('express');
const pool    = require('../config/db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const conditions = ["t.status='completada'"];
    const params = [];
    let i = 1;
    if (req.query.type)    { conditions.push(`t.type=$${i++}`);    params.push(req.query.type); }
    if (req.query.user_id) { conditions.push(`t.assigned_user_id=$${i++}`); params.push(req.query.user_id); }
    if (req.query.from)    { conditions.push(`t.completed_at>=$${i++}`);   params.push(req.query.from); }
    if (req.query.to)      { conditions.push(`t.completed_at<=$${i++}`);   params.push(req.query.to); }

    const where = 'WHERE ' + conditions.join(' AND ');
    const page   = Math.max(1, parseInt(req.query.page  || '1'));
    const limit  = Math.min(100, parseInt(req.query.limit || '50'));
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(`
      SELECT t.*,
        ol.name AS origin_name, dl.name AS destination_name,
        m.name AS material_name, m.unit AS material_unit,
        u.username AS assigned_username,
        EXTRACT(EPOCH FROM (t.completed_at - t.started_at))::int AS duration_sec
      FROM tasks t
      JOIN locations ol ON t.origin_location_id = ol.id
      JOIN locations dl ON t.destination_location_id = dl.id
      JOIN materials m  ON t.material_id = m.id
      LEFT JOIN users u ON t.assigned_user_id = u.id
      ${where} ORDER BY t.completed_at DESC LIMIT $${i} OFFSET $${i+1}
    `, [...params, limit, offset]);

    const { rows: count } = await pool.query(
      `SELECT COUNT(*) FROM tasks t ${where}`, params
    );
    res.json({ data: rows, total: parseInt(count[0].count), page, limit });
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

module.exports = router;
