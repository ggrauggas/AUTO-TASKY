require('dotenv').config();
const pool = require('../config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    // Tabla system_events (nueva)
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_events (
        id          SERIAL PRIMARY KEY,
        event_type  VARCHAR(60) NOT NULL,
        user_id     INTEGER REFERENCES users(id),
        description TEXT NOT NULL,
        timestamp   TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla system_events OK.');

    // Actualiza intervalos de simulación a los nuevos valores
    await client.query(`
      UPDATE simulation_config SET
        interval_machine_request_sec = 300,
        interval_relocate_sec        = 300,
        interval_user_action_sec     = 60
      WHERE id = 1
    `);
    console.log('✅ Intervalos de simulación actualizados (300s / 300s / 60s).');

  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
