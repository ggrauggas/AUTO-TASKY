const express   = require('express');
const pool      = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { logEvent } = require('../services/activityService');

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.get('/status', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM simulation_config WHERE id=1');
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

router.post('/toggle', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE simulation_config SET active=NOT active WHERE id=1 RETURNING *'
    );
    const state = rows[0].active ? 'activado' : 'desactivado';
    const { rows: u } = await pool.query('SELECT username FROM users WHERE id=$1', [req.user.id]);
    const who = u.length ? `Admin ${u[0].username}` : 'Admin';
    logEvent('simulation_toggle', `${who} ha ${state} la simulación automática`, req.user.id);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

router.put('/config', async (req, res) => {
  const { interval_machine_request_sec, interval_relocate_sec, interval_user_action_sec } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE simulation_config SET
         interval_machine_request_sec = COALESCE($1, interval_machine_request_sec),
         interval_relocate_sec        = COALESCE($2, interval_relocate_sec),
         interval_user_action_sec     = COALESCE($3, interval_user_action_sec)
       WHERE id=1 RETURNING *`,
      [interval_machine_request_sec, interval_relocate_sec, interval_user_action_sec]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

module.exports = router;
