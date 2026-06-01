const pool = require('../config/db');
const { adjustQuantity } = require('./inventoryService');
const { logEvent } = require('./activityService');

// Timers activos de procesado: machineId -> timeoutId
const processingTimers = {};

async function startProcessing(machineId) {
  const { rows } = await pool.query('SELECT * FROM machines WHERE id=$1', [machineId]);
  if (!rows.length) return;
  const machine = rows[0];

  await pool.query(
    'UPDATE machines SET status=$1, updated_at=NOW() WHERE id=$2',
    ['processing', machineId]
  );

  const ms = (machine.processing_time_sec || 60) * 1000;
  if (processingTimers[machineId]) clearTimeout(processingTimers[machineId]);

  processingTimers[machineId] = setTimeout(async () => {
    try {
      const { rows: m } = await pool.query('SELECT * FROM machines WHERE id=$1', [machineId]);
      if (!m.length) return;
      const mac = m[0];
      const produced = parseFloat(mac.input_quantity) || 0;

      await pool.query(
        `UPDATE machines SET status='output_ready', output_quantity=output_quantity+$1,
         input_quantity=0, updated_at=NOW() WHERE id=$2`,
        [produced, machineId]
      );

      // Actualiza inventario salida de máquina
      if (mac.output_material_id) {
        const { rows: outLoc } = await pool.query(
          "SELECT id FROM locations WHERE machine_id=$1 AND type='salida_maquina'", [machineId]
        );
        if (outLoc.length) {
          await adjustQuantity(pool, outLoc[0].id, mac.output_material_id, produced);
        }
      }

      // Log de máquina
      const { rows: matOut } = await pool.query('SELECT name, unit FROM materials WHERE id=$1', [mac.output_material_id]);
      const matName = matOut.length ? matOut[0].name : 'material';
      const matUnit = matOut.length ? matOut[0].unit : '';
      logEvent('machine_complete', `La ${mac.name} ha terminado de procesar — ${produced} ${matUnit} de ${matName} disponible para recoger`);

      // Genera tarea de eliminación de residuo automáticamente
      const { createResidueTask } = require('./taskService');
      await createResidueTask(machineId);

      delete processingTimers[machineId];
    } catch (err) {
      console.error('Error en timer de máquina:', err.message);
    }
  }, ms);
}

async function tryStartProcessing(machineId) {
  const { rows } = await pool.query('SELECT * FROM machines WHERE id=$1', [machineId]);
  if (!rows.length) return;
  const m = rows[0];
  if (m.status === 'idle' || m.status === 'waiting_input') {
    if (parseFloat(m.input_quantity) > 0) {
      await startProcessing(machineId);
    }
  }
}

module.exports = { startProcessing, tryStartProcessing, processingTimers };
