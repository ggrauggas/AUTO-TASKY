const express   = require('express');
const pool      = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { logEvent } = require('../services/activityService');

const router = express.Router();
router.use(authenticate, authorize('admin'));

// POST /api/admin/reset  — limpia datos operativos, conserva configuración
router.post('/reset', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Borrar historial y tareas
    await client.query('DELETE FROM task_history');
    await client.query('DELETE FROM tasks');

    // 2. Resetear máquinas a idle sin material
    await client.query(`
      UPDATE machines
      SET status = 'idle', input_quantity = 0, output_quantity = 0, updated_at = NOW()
    `);

    // 3. Borrar inventario actual y restaurar valores semilla
    await client.query('DELETE FROM inventory');

    // Reinserta inventario inicial usando los nombres de ubicación y material del seed
    await client.query(`
      INSERT INTO inventory (location_id, material_id, quantity)
      SELECT l.id, m.id, 200
      FROM locations l, materials m
      WHERE l.name = 'Slot A1' AND m.name = 'Acero'
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO inventory (location_id, material_id, quantity)
      SELECT l.id, m.id, 150
      FROM locations l, materials m
      WHERE l.name = 'Slot A2' AND m.name = 'Plástico PET'
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO inventory (location_id, material_id, quantity)
      SELECT l.id, m.id, 100
      FROM locations l, materials m
      WHERE l.name = 'Slot B1' AND m.name = 'Aluminio'
      ON CONFLICT DO NOTHING
    `);

    // 4. Limpiar log de actividad
    await client.query('DELETE FROM system_events');

    await client.query('COMMIT');

    // Log del reset (después del commit, la tabla ya está vacía pero este INSERT es nuevo)
    await logEvent('system', `Admin ${req.user.username} ha ejecutado una limpieza completa del sistema`, req.user.id);

    res.json({ message: 'Sistema limpiado correctamente. Inventario restaurado a valores iniciales.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: true, message: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
