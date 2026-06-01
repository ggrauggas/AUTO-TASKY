const pool = require('../config/db');

const TYPE_LABEL = {
  enviar_materia_prima: 'envío de materia prima',
  ubicar_elemento:      'ubicación de elemento',
  eliminar_residuo:     'eliminación de residuo',
};

async function logEvent(eventType, description, userId = null) {
  try {
    await pool.query(
      'INSERT INTO system_events (event_type, user_id, description) VALUES ($1,$2,$3)',
      [eventType, userId || null, description]
    );
  } catch (err) {
    // Never throw — logging must never break the main flow
    console.error('[Activity] logEvent error:', err.message);
  }
}

async function logTaskTransition(task, fromStatus, toStatus, userId, note) {
  try {
    const tl   = TYPE_LABEL[task.type] || task.type;
    const mat  = task.material_name  || `material #${task.material_id}`;
    const unit = task.material_unit  || '';
    const qty  = task.quantity;
    const orig = task.origin_name      || `ubicación #${task.origin_location_id}`;
    const dest = task.destination_name || `ubicación #${task.destination_location_id}`;

    // Resolve who
    let who = 'Sistema';
    if (userId) {
      try {
        const { rows } = await pool.query(
          'SELECT username, role FROM users WHERE id=$1', [userId]
        );
        if (rows.length) {
          const roleMap = { admin: 'Admin', jefe_zona: 'Jefe', peon_almacen: 'Peón' };
          who = `${roleMap[rows[0].role] || rows[0].role} ${rows[0].username}`;
        }
      } catch (_) { /* use default 'Sistema' */ }
    }

    const taskRef = `tarea #${task.id} (${tl})`;
    let description = '';

    if (!fromStatus && toStatus === 'sin_asignar') {
      const sim = task.is_simulation ? ' [simulación]' : '';
      description = `Nueva tarea creada: ${qty} ${unit} de ${mat} — de ${orig} a ${dest}${sim}`;
    } else if (!fromStatus && toStatus === 'asignada') {
      description = `${who} ha creado y asignado la ${taskRef}`;
    } else if (toStatus === 'asignada' && fromStatus === 'sin_asignar') {
      description = `${who} ha tomado la ${taskRef}`;
    } else if (toStatus === 'asignada') {
      description = `${who} ha asignado la ${taskRef}`;
    } else if (toStatus === 'en_proceso') {
      description = `${who} ha iniciado la ${taskRef}`;
    } else if (toStatus === 'pausada') {
      description = `${who} ha pausado la ${taskRef}${note ? ` — Motivo: "${note}"` : ''}`;
    } else if (toStatus === 'en_proceso' && fromStatus === 'pausada') {
      description = `${who} ha reanudado la ${taskRef}`;
    } else if (toStatus === 'completada') {
      description = `${who} ha completado: ${qty} ${unit} de ${mat} de "${orig}" a "${dest}"`;
    }

    if (description) {
      await logEvent('task_' + toStatus, description, userId || null);
    }
  } catch (err) {
    console.error('[Activity] logTaskTransition error:', err.message);
  }
}

async function logTaskDeleted(taskId, taskType, userId) {
  try {
    let who = 'Admin';
    if (userId) {
      const { rows } = await pool.query('SELECT username FROM users WHERE id=$1', [userId]);
      if (rows.length) who = `Admin ${rows[0].username}`;
    }
    const tl = TYPE_LABEL[taskType] || taskType;
    await logEvent('task_deleted', `${who} ha eliminado la tarea #${taskId} (${tl})`, userId || null);
  } catch (err) {
    console.error('[Activity] logTaskDeleted error:', err.message);
  }
}

module.exports = { logEvent, logTaskTransition, logTaskDeleted };
