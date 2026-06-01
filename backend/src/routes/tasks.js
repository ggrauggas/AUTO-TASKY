const express   = require('express');
const pool      = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { validateTaskCreation, completeTask, TRANSITIONS } = require('../services/taskService');
const { logEvent, logTaskTransition, logTaskDeleted } = require('../services/activityService');

const router = express.Router();
router.use(authenticate);

const MAX_ACTIVE = parseInt(process.env.MAX_ACTIVE_TASKS_PER_USER || '1');

const TASK_SELECT = `
  SELECT t.*,
    ol.name AS origin_name, ol.type AS origin_type,
    dl.name AS destination_name, dl.type AS destination_type,
    m.name AS material_name, m.unit AS material_unit,
    u.username AS assigned_username,
    c.username AS created_by_username
  FROM tasks t
  JOIN locations ol ON t.origin_location_id = ol.id
  JOIN locations dl ON t.destination_location_id = dl.id
  JOIN materials m  ON t.material_id = m.id
  LEFT JOIN users u ON t.assigned_user_id = u.id
  LEFT JOIN users c ON t.created_by_user_id = c.id
`;

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let i = 1;
    if (req.query.status)           { conditions.push(`t.status=$${i++}`);           params.push(req.query.status); }
    if (req.query.type)             { conditions.push(`t.type=$${i++}`);             params.push(req.query.type); }
    if (req.query.assigned_user_id) { conditions.push(`t.assigned_user_id=$${i++}`); params.push(req.query.assigned_user_id); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const page  = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, parseInt(req.query.limit || '20'));
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `${TASK_SELECT} ${where} ORDER BY t.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    );
    const { rows: count } = await pool.query(
      `SELECT COUNT(*) FROM tasks t ${where}`, params
    );
    res.json({ data: rows, total: parseInt(count[0].count), page, limit });
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(TASK_SELECT + ' WHERE t.id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: true, message: 'Tarea no encontrada.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

// GET /api/tasks/:id/history
router.get('/:id/history', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT th.*, u.username FROM task_history th
       LEFT JOIN users u ON th.user_id = u.id
       WHERE th.task_id=$1 ORDER BY th.timestamp`, [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

// POST /api/tasks  (jefe_zona + admin)
router.post('/', authorize('jefe_zona', 'admin'), async (req, res) => {
  const { type, origin_location_id, destination_location_id, material_id, quantity, assigned_user_id } = req.body;
  if (!type || !origin_location_id || !destination_location_id || !material_id || !quantity) {
    return res.status(400).json({ error: true, message: 'Faltan campos obligatorios.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validateTaskCreation(client, { type, origin_location_id, destination_location_id, material_id, quantity });
    const { rows } = await client.query(
      `INSERT INTO tasks (type, origin_location_id, destination_location_id, material_id, quantity,
        assigned_user_id, created_by_user_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [type, origin_location_id, destination_location_id, material_id, quantity,
       assigned_user_id || null, req.user.id,
       assigned_user_id ? 'asignada' : 'sin_asignar']
    );
    await client.query(
      'INSERT INTO task_history (task_id, user_id, from_status, to_status) VALUES ($1,$2,$3,$4)',
      [rows[0].id, req.user.id, null, rows[0].status]
    );
    await client.query('COMMIT');
    // Log actividad (fuera de transacción)
    const fullTask = { ...rows[0],
      material_name: null, material_unit: null,
      origin_name: null, destination_name: null,
    };
    const { rows: taskFull } = await pool.query(`
      SELECT t.*, m.name AS material_name, m.unit AS material_unit,
        ol.name AS origin_name, dl.name AS destination_name
      FROM tasks t
      JOIN materials m  ON t.material_id = m.id
      JOIN locations ol ON t.origin_location_id = ol.id
      JOIN locations dl ON t.destination_location_id = dl.id
      WHERE t.id = $1`, [rows[0].id]);
    if (taskFull.length) logTaskTransition(taskFull[0], null, rows[0].status, req.user.id, null);
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code) return res.status(422).json({ error: true, ...err });
    res.status(500).json({ error: true, message: err.message });
  } finally { client.release(); }
});

// PUT /api/tasks/:id  (jefe_zona + admin — edición general)
router.put('/:id', authorize('jefe_zona', 'admin'), async (req, res) => {
  const { origin_location_id, destination_location_id, material_id, quantity, assigned_user_id } = req.body;
  try {
    const { rows: cur } = await pool.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (!cur.length) return res.status(404).json({ error: true, message: 'Tarea no encontrada.' });
    if (cur[0].status === 'completada') {
      return res.status(422).json({ error: true, message: 'No se puede editar una tarea completada.' });
    }
    const c = cur[0];
    const { rows } = await pool.query(
      `UPDATE tasks SET origin_location_id=$1, destination_location_id=$2, material_id=$3,
       quantity=$4, assigned_user_id=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [
        origin_location_id      ?? c.origin_location_id,
        destination_location_id ?? c.destination_location_id,
        material_id             ?? c.material_id,
        quantity                ?? c.quantity,
        assigned_user_id        !== undefined ? (assigned_user_id || null) : c.assigned_user_id,
        req.params.id
      ]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

// DELETE /api/tasks/:id  (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING id, type', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: true, message: 'Tarea no encontrada.' });
    logTaskDeleted(rows[0].id, rows[0].type, req.user.id);
    res.json({ message: 'Tarea eliminada.' });
  } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

// ---- Transiciones de estado ----

async function transition(req, res, toStatus, extraValidation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM tasks WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: true, message: 'Tarea no encontrada.' }); }
    const task = rows[0];

    // Permiso: solo el asignado, jefe_zona o admin
    if (req.user.role === 'peon_almacen' && task.assigned_user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Solo el usuario asignado puede cambiar el estado.' });
    }

    if (!TRANSITIONS[task.status]?.includes(toStatus)) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: true, code: 'INVALID_TRANSITION', message: `No se puede pasar de '${task.status}' a '${toStatus}'.` });
    }

    if (extraValidation) {
      const err = await extraValidation(task, client);
      if (err) { await client.query('ROLLBACK'); return res.status(422).json({ error: true, ...err }); }
    }

    const now = new Date();
    const timestamps = {};
    if (toStatus === 'en_proceso' && !task.started_at) timestamps.started_at = now;
    if (toStatus === 'pausada')    timestamps.paused_at   = now;
    if (toStatus === 'completada') timestamps.completed_at = now;

    const setClauses = ['status=$1', 'updated_at=NOW()'];
    const vals = [toStatus];
    let idx = 2;
    for (const [k, v] of Object.entries(timestamps)) {
      setClauses.push(`${k}=$${idx++}`);
      vals.push(v);
    }
    vals.push(req.params.id);

    const { rows: updated } = await client.query(
      `UPDATE tasks SET ${setClauses.join(',')} WHERE id=$${idx} RETURNING *`, vals
    );

    await client.query(
      'INSERT INTO task_history (task_id, user_id, from_status, to_status, note) VALUES ($1,$2,$3,$4,$5)',
      [task.id, req.user.id, task.status, toStatus, req.body?.reason || null]
    );

    if (toStatus === 'completada') {
      await completeTask(client, task);
    }

    await client.query('COMMIT');

    // Log actividad (fuera de transacción)
    const { rows: taskFull } = await pool.query(`
      SELECT t.*, m.name AS material_name, m.unit AS material_unit,
        ol.name AS origin_name, dl.name AS destination_name
      FROM tasks t
      JOIN materials m  ON t.material_id = m.id
      JOIN locations ol ON t.origin_location_id = ol.id
      JOIN locations dl ON t.destination_location_id = dl.id
      WHERE t.id = $1`, [task.id]);
    if (taskFull.length) logTaskTransition(taskFull[0], task.status, toStatus, req.user.id, req.body?.reason || null);

    res.json(updated[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code) return res.status(422).json({ error: true, ...err });
    res.status(500).json({ error: true, message: err.message });
  } finally { client.release(); }
}

// PUT /api/tasks/:id/take  — cualquier usuario se auto-asigna
router.put('/:id/take', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM tasks WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: true, message: 'Tarea no encontrada.' }); }
    if (rows[0].status !== 'sin_asignar') { await client.query('ROLLBACK'); return res.status(422).json({ error: true, message: 'La tarea ya está asignada.' }); }

    // Limitar tareas activas por peón
    if (req.user.role === 'peon_almacen') {
      const { rows: active } = await client.query(
        `SELECT COUNT(*) FROM tasks WHERE assigned_user_id=$1 AND status IN ('asignada','en_proceso')`,
        [req.user.id]
      );
      if (parseInt(active[0].count) >= MAX_ACTIVE) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: true, message: `Límite de ${MAX_ACTIVE} tareas activas alcanzado.` });
      }
    }

    const { rows: updated } = await client.query(
      `UPDATE tasks SET assigned_user_id=$1, status='asignada', updated_at=NOW() WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    await client.query(
      'INSERT INTO task_history (task_id, user_id, from_status, to_status) VALUES ($1,$2,$3,$4)',
      [rows[0].id, req.user.id, 'sin_asignar', 'asignada']
    );
    await client.query('COMMIT');
    const { rows: tf } = await pool.query(`SELECT t.*, m.name AS material_name, m.unit AS material_unit, ol.name AS origin_name, dl.name AS destination_name FROM tasks t JOIN materials m ON t.material_id=m.id JOIN locations ol ON t.origin_location_id=ol.id JOIN locations dl ON t.destination_location_id=dl.id WHERE t.id=$1`, [rows[0].id]);
    if (tf.length) logTaskTransition(tf[0], 'sin_asignar', 'asignada', req.user.id, null);
    res.json(updated[0]);
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: true, message: err.message }); }
  finally { client.release(); }
});

// PUT /api/tasks/:id/assign  (jefe_zona + admin)
router.put('/:id/assign', authorize('jefe_zona', 'admin'), async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: true, message: 'user_id requerido.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM tasks WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: true, message: 'Tarea no encontrada.' }); }
    const prev = rows[0].status;
    const { rows: updated } = await client.query(
      `UPDATE tasks SET assigned_user_id=$1, status='asignada', updated_at=NOW() WHERE id=$2 RETURNING *`,
      [user_id, req.params.id]
    );
    await client.query(
      'INSERT INTO task_history (task_id, user_id, from_status, to_status) VALUES ($1,$2,$3,$4)',
      [rows[0].id, req.user.id, prev, 'asignada']
    );
    await client.query('COMMIT');
    const { rows: tf } = await pool.query(`SELECT t.*, m.name AS material_name, m.unit AS material_unit, ol.name AS origin_name, dl.name AS destination_name FROM tasks t JOIN materials m ON t.material_id=m.id JOIN locations ol ON t.origin_location_id=ol.id JOIN locations dl ON t.destination_location_id=dl.id WHERE t.id=$1`, [rows[0].id]);
    if (tf.length) logTaskTransition(tf[0], prev, 'asignada', req.user.id, null);
    res.json(updated[0]);
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: true, message: err.message }); }
  finally { client.release(); }
});

// PUT /api/tasks/:id/start
router.put('/:id/start', (req, res) => transition(req, res, 'en_proceso', async (task, client) => {
  if (req.user.role === 'peon_almacen') {
    const { rows } = await client.query(
      `SELECT COUNT(*) FROM tasks WHERE assigned_user_id=$1 AND status='en_proceso'`,
      [req.user.id]
    );
    if (parseInt(rows[0].count) >= 1) {
      return { code: 'TASK_LIMIT', message: 'Ya tienes una tarea en proceso. Complétala o paúsala antes de iniciar otra.' };
    }
  }
  return null;
}));

// PUT /api/tasks/:id/pause
router.put('/:id/pause', (req, res) => transition(req, res, 'pausada', async (task) => {
  if (!req.body?.reason?.trim()) return { code: 'PAUSE_REASON_REQUIRED', message: 'Se requiere motivo de pausa.' };
  // Guarda el motivo en la tarea
  await pool.query('UPDATE tasks SET pause_reason=$1 WHERE id=$2', [req.body.reason, task.id]);
  return null;
}));

// PUT /api/tasks/:id/resume
router.put('/:id/resume', (req, res) => transition(req, res, 'en_proceso'));

// PUT /api/tasks/:id/complete
router.put('/:id/complete', (req, res) => transition(req, res, 'completada'));

module.exports = router;
