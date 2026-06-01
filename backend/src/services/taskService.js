const pool = require('../config/db');
const { moveInventory, getQuantity } = require('./inventoryService');

// Transiciones válidas
const TRANSITIONS = {
  sin_asignar: ['asignada'],
  asignada:    ['en_proceso', 'sin_asignar'],
  en_proceso:  ['pausada', 'completada'],
  pausada:     ['en_proceso', 'completada'],
  completada:  [],
};

async function validateTaskCreation(client, { type, origin_location_id, destination_location_id, material_id, quantity }) {
  // Origen tiene suficiente inventario
  const available = await getQuantity(client, origin_location_id, material_id);
  if (available < quantity) {
    throw { code: 'INSUFFICIENT_INVENTORY', message: `Inventario insuficiente en origen. Disponible: ${available}` };
  }

  if (type === 'enviar_materia_prima') {
    // Destino debe ser entrada_maquina
    const { rows: destLoc } = await client.query('SELECT * FROM locations WHERE id=$1', [destination_location_id]);
    if (!destLoc.length || destLoc[0].type !== 'entrada_maquina') {
      throw { code: 'INVALID_DESTINATION', message: 'El destino debe ser una entrada de máquina.' };
    }
    // Máquina acepta ese material
    const { rows: mach } = await client.query(
      'SELECT * FROM machines WHERE id=$1', [destLoc[0].machine_id]
    );
    if (mach.length && mach[0].input_material_id && mach[0].input_material_id !== material_id) {
      throw { code: 'MACHINE_NOT_ACCEPTING', message: 'La máquina no acepta ese material.' };
    }
    // No existe ya tarea activa para esa entrada
    const { rows: active } = await client.query(
      `SELECT id FROM tasks WHERE destination_location_id=$1
       AND status NOT IN ('completada') LIMIT 1`, [destination_location_id]
    );
    if (active.length) {
      throw { code: 'TASK_CONFLICT', message: 'Ya existe una tarea activa para esa entrada de máquina.' };
    }
  }

  if (type === 'eliminar_residuo') {
    const { rows: destLoc } = await client.query('SELECT * FROM locations WHERE id=$1', [destination_location_id]);
    if (!destLoc.length || destLoc[0].type !== 'trituradora') {
      throw { code: 'INVALID_DESTINATION', message: 'El destino debe ser una trituradora.' };
    }
    const { rows: origLoc } = await client.query('SELECT * FROM locations WHERE id=$1', [origin_location_id]);
    if (!origLoc.length || origLoc[0].type !== 'salida_maquina') {
      throw { code: 'INVALID_ORIGIN', message: 'El origen debe ser la salida de una máquina.' };
    }
  }
}

async function completeTask(client, task) {
  await moveInventory(client, task.origin_location_id, task.destination_location_id, task.material_id, parseFloat(task.quantity));

  if (task.type === 'enviar_materia_prima') {
    // Incrementa input_quantity de la máquina y arranca procesado
    const { rows: destLoc } = await client.query('SELECT * FROM locations WHERE id=$1', [task.destination_location_id]);
    if (destLoc.length && destLoc[0].machine_id) {
      const machineId = destLoc[0].machine_id;
      await client.query(
        `UPDATE machines SET input_quantity=input_quantity+$1, status='processing', updated_at=NOW() WHERE id=$2`,
        [task.quantity, machineId]
      );
      // Lanza el timer (fuera de la transacción)
      process.nextTick(async () => {
        const { tryStartProcessing } = require('./machineService');
        await tryStartProcessing(machineId).catch(console.error);
      });
    }
  }

  if (task.type === 'eliminar_residuo') {
    // Reduce output_quantity de la máquina
    const { rows: origLoc } = await client.query('SELECT * FROM locations WHERE id=$1', [task.origin_location_id]);
    if (origLoc.length && origLoc[0].machine_id) {
      const machineId = origLoc[0].machine_id;
      await client.query(
        `UPDATE machines SET output_quantity=GREATEST(0, output_quantity-$1), updated_at=NOW() WHERE id=$2`,
        [task.quantity, machineId]
      );
      // Si output_quantity llega a 0, vuelve a idle
      await client.query(
        `UPDATE machines SET status='idle' WHERE id=$1 AND output_quantity<=0`, [machineId]
      );
    }
  }
}

// Crea tarea de residuo automáticamente al terminar procesado
async function createResidueTask(machineId) {
  const { rows: m } = await pool.query('SELECT * FROM machines WHERE id=$1', [machineId]);
  if (!m.length) return;
  const machine = m[0];
  if (!machine.output_material_id || machine.output_quantity <= 0) return;

  const { rows: origLoc } = await pool.query(
    "SELECT id FROM locations WHERE machine_id=$1 AND type='salida_maquina'", [machineId]
  );
  const { rows: triLoc } = await pool.query(
    "SELECT id FROM locations WHERE type='trituradora' AND active=true LIMIT 1"
  );
  if (!origLoc.length || !triLoc.length) return;

  // No duplicar si ya existe tarea activa
  const { rows: existing } = await pool.query(
    `SELECT id FROM tasks WHERE origin_location_id=$1 AND type='eliminar_residuo'
     AND status NOT IN ('completada') LIMIT 1`, [origLoc[0].id]
  );
  if (existing.length) return;

  await pool.query(
    `INSERT INTO tasks (type, origin_location_id, destination_location_id, material_id, quantity, is_simulation)
     VALUES ('eliminar_residuo',$1,$2,$3,$4,true)`,
    [origLoc[0].id, triLoc[0].id, machine.output_material_id, machine.output_quantity]
  );
}

module.exports = { validateTaskCreation, completeTask, createResidueTask, TRANSITIONS };
