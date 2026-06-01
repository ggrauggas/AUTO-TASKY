const cron = require('node-cron');
const pool = require('../config/db');
const { getQuantity } = require('../services/inventoryService');
const { createResidueTask } = require('../services/taskService');
const { logEvent, logTaskTransition } = require('../services/activityService');

let machineTask   = null;
let relocateTask  = null;
let userTask      = null;
let lastIntervals = {};

async function getConfig() {
  const { rows } = await pool.query('SELECT * FROM simulation_config WHERE id=1');
  return rows[0];
}

function secToCron(sec) {
  // node-cron no soporta intervalos arbitrarios en segundos, usamos setInterval
  return sec;
}

// ---- Generadores de tareas ----

async function generateMachineTask() {
  try {
    const { rows: machines } = await pool.query(
      `SELECT m.* FROM machines m WHERE m.active=true AND m.status IN ('idle','waiting_input')`
    );
    for (const machine of machines) {
      if (!machine.input_material_id) continue;
      // Comprueba que no haya tarea activa ya
      const { rows: active } = await pool.query(
        `SELECT t.id FROM tasks t
         JOIN locations l ON t.destination_location_id = l.id
         WHERE l.machine_id=$1 AND l.type='entrada_maquina'
         AND t.status NOT IN ('completada') LIMIT 1`, [machine.id]
      );
      if (active.length) continue;

      // Busca origen con ese material
      const { rows: origins } = await pool.query(
        `SELECT i.location_id, i.quantity, l.name FROM inventory i
         JOIN locations l ON i.location_id = l.id
         WHERE i.material_id=$1 AND i.quantity>0 AND l.type='almacen_slot' AND l.active=true
         ORDER BY i.quantity DESC LIMIT 1`, [machine.input_material_id]
      );
      if (!origins.length) continue;

      const { rows: destLoc } = await pool.query(
        "SELECT id FROM locations WHERE machine_id=$1 AND type='entrada_maquina' LIMIT 1", [machine.id]
      );
      if (!destLoc.length) continue;

      const qty = Math.min(parseFloat(origins[0].quantity), 50);
      const { rows: newTask } = await pool.query(
        `INSERT INTO tasks (type, origin_location_id, destination_location_id, material_id, quantity, is_simulation)
         VALUES ('enviar_materia_prima',$1,$2,$3,$4,true) RETURNING *`,
        [origins[0].location_id, destLoc[0].id, machine.input_material_id, qty]
      );
      const { rows: matInfo } = await pool.query('SELECT name, unit FROM materials WHERE id=$1', [machine.input_material_id]);
      const matName = matInfo.length ? matInfo[0].name : 'material';
      const matUnit = matInfo.length ? matInfo[0].unit : '';
      logEvent('sim_task_created', `[Simulación] Nueva tarea: enviar ${qty} ${matUnit} de ${matName} desde ${origins[0].name} a ${machine.name}`);
    }
  } catch (err) { console.error('[SIM] generateMachineTask:', err.message); }
}

async function generateRelocateTask() {
  try {
    // Elige un slot origen con inventario
    const { rows: origins } = await pool.query(
      `SELECT i.location_id, i.material_id, i.quantity FROM inventory i
       JOIN locations l ON i.location_id = l.id
       WHERE i.quantity>0 AND l.type='almacen_slot' AND l.active=true
       ORDER BY RANDOM() LIMIT 1`
    );
    if (!origins.length) return;

    // Elige slot destino distinto
    const { rows: dests } = await pool.query(
      `SELECT id FROM locations WHERE type='almacen_slot' AND active=true AND id<>$1
       ORDER BY RANDOM() LIMIT 1`, [origins[0].location_id]
    );
    if (!dests.length) return;

    const qty = Math.max(1, Math.round(parseFloat(origins[0].quantity) * (Math.random() * 0.4 + 0.1)));
    await pool.query(
      `INSERT INTO tasks (type, origin_location_id, destination_location_id, material_id, quantity, is_simulation)
       VALUES ('ubicar_elemento',$1,$2,$3,$4,true)`,
      [origins[0].location_id, dests[0].id, origins[0].material_id, qty]
    );
  } catch (err) { console.error('[SIM] generateRelocateTask:', err.message); }
}

async function simulateUserAction() {
  try {
    // Toma tarea sin asignar aleatoria
    const { rows: tasks } = await pool.query(
      `SELECT * FROM tasks WHERE status='sin_asignar' ORDER BY RANDOM() LIMIT 1`
    );
    if (!tasks.length) return;
    const task = tasks[0];

    // Round-robin: peón libre con la asignación más antigua (o sin ninguna)
    const { rows: users } = await pool.query(
      `SELECT u.id
       FROM users u
       WHERE u.role='peon_almacen' AND u.active=true
         AND NOT EXISTS (
           SELECT 1 FROM tasks t
           WHERE t.assigned_user_id = u.id
             AND t.status IN ('asignada','en_proceso')
         )
       ORDER BY (
         SELECT MAX(t2.updated_at) FROM tasks t2
         WHERE t2.assigned_user_id = u.id
       ) ASC NULLS FIRST
       LIMIT 1`
    );
    if (!users.length) return; // Todos los peones ocupados — dejar sin asignar
    const userId = users[0].id;

    // Asignar
    await pool.query(
      `UPDATE tasks SET assigned_user_id=$1, status='asignada', updated_at=NOW() WHERE id=$2`,
      [userId, task.id]
    );
    await pool.query(
      'INSERT INTO task_history (task_id, user_id, from_status, to_status) VALUES ($1,$2,$3,$4)',
      [task.id, userId, 'sin_asignar', 'asignada']
    );

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    // Iniciar tras 15-40s (el trabajador va al punto de origen)
    await delay(15000 + Math.random() * 25000);
    await pool.query(
      `UPDATE tasks SET status='en_proceso', started_at=NOW(), updated_at=NOW() WHERE id=$1 AND status='asignada'`,
      [task.id]
    );
    await pool.query(
      'INSERT INTO task_history (task_id, user_id, from_status, to_status) VALUES ($1,$2,$3,$4)',
      [task.id, userId, 'asignada', 'en_proceso']
    );

    // 20% de probabilidad de pausa de 30-60s
    if (Math.random() < 0.2) {
      await delay(30000 + Math.random() * 30000);
      const reasons = ['Descanso breve', 'Revisión de material', 'Consulta con jefe', 'Equipo en uso'];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      await pool.query(
        `UPDATE tasks SET status='pausada', pause_reason=$1, paused_at=NOW(), updated_at=NOW() WHERE id=$2 AND status='en_proceso'`,
        [reason, task.id]
      );
      await pool.query(
        'INSERT INTO task_history (task_id, user_id, from_status, to_status, note) VALUES ($1,$2,$3,$4,$5)',
        [task.id, userId, 'en_proceso', 'pausada', reason]
      );
      await delay(30000 + Math.random() * 30000);
      await pool.query(
        `UPDATE tasks SET status='en_proceso', updated_at=NOW() WHERE id=$1 AND status='pausada'`, [task.id]
      );
      await pool.query(
        'INSERT INTO task_history (task_id, user_id, from_status, to_status) VALUES ($1,$2,$3,$4)',
        [task.id, userId, 'pausada', 'en_proceso']
      );
    }

    // Completar tras 2-4 min de trabajo (tiempo total tarea: ~3-5 min)
    await delay(120000 + Math.random() * 120000);

    // Completa con transacción (mueve inventario)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: cur } = await client.query('SELECT * FROM tasks WHERE id=$1 FOR UPDATE', [task.id]);
      if (!cur.length || cur[0].status !== 'en_proceso') { await client.query('ROLLBACK'); return; }

      const { completeTask } = require('../services/taskService');
      await completeTask(client, cur[0]);

      await client.query(
        `UPDATE tasks SET status='completada', completed_at=NOW(), updated_at=NOW() WHERE id=$1`, [task.id]
      );
      await client.query(
        'INSERT INTO task_history (task_id, user_id, from_status, to_status) VALUES ($1,$2,$3,$4)',
        [task.id, userId, 'en_proceso', 'completada']
      );
      await client.query('COMMIT');

      // Log completado simulado
      const { rows: tf } = await pool.query(`SELECT t.*, m.name AS material_name, m.unit AS material_unit, ol.name AS origin_name, dl.name AS destination_name FROM tasks t JOIN materials m ON t.material_id=m.id JOIN locations ol ON t.origin_location_id=ol.id JOIN locations dl ON t.destination_location_id=dl.id WHERE t.id=$1`, [task.id]);
      if (tf.length) logTaskTransition(tf[0], 'en_proceso', 'completada', userId, null);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[SIM] Error completando tarea:', err.message);
    } finally { client.release(); }

  } catch (err) { console.error('[SIM] simulateUserAction:', err.message); }
}

// ---- Control de intervalos ----

function clearAll() {
  if (machineTask)  { clearInterval(machineTask);  machineTask  = null; }
  if (relocateTask) { clearInterval(relocateTask); relocateTask = null; }
  if (userTask)     { clearInterval(userTask);     userTask     = null; }
}

async function applyConfig(cfg) {
  const changed =
    cfg.interval_machine_request_sec !== lastIntervals.machine ||
    cfg.interval_relocate_sec        !== lastIntervals.relocate ||
    cfg.interval_user_action_sec     !== lastIntervals.user;

  if (!cfg.active) { clearAll(); return; }
  if (!changed && machineTask) return;

  clearAll();

  // Ejecutar inmediatamente al activar, sin esperar el primer intervalo
  generateMachineTask().catch(() => {});
  generateRelocateTask().catch(() => {});

  machineTask   = setInterval(generateMachineTask,  cfg.interval_machine_request_sec * 1000);
  relocateTask  = setInterval(generateRelocateTask, cfg.interval_relocate_sec        * 1000);
  userTask      = setInterval(simulateUserAction,   cfg.interval_user_action_sec     * 1000);
  lastIntervals = {
    machine:  cfg.interval_machine_request_sec,
    relocate: cfg.interval_relocate_sec,
    user:     cfg.interval_user_action_sec,
  };
  console.log('[SIM] Simulación activa — intervalos:', lastIntervals);
}

// Tick de supervisión: re-lee config cada 5 segundos
async function startSimulation() {
  setInterval(async () => {
    try {
      const cfg = await getConfig();
      await applyConfig(cfg);
    } catch (err) { console.error('[SIM] Error en tick:', err.message); }
  }, 5000);
  console.log('[SIM] Motor de simulación iniciado.');
}

module.exports = { startSimulation };
