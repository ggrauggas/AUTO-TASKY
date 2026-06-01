require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes       = require('./routes/auth');
const userRoutes       = require('./routes/users');
const materialRoutes   = require('./routes/materials');
const locationRoutes   = require('./routes/locations');
const machineRoutes    = require('./routes/machines');
const inventoryRoutes  = require('./routes/inventory');
const taskRoutes       = require('./routes/tasks');
const logRoutes        = require('./routes/logs');
const simulationRoutes = require('./routes/simulation');
const activityRoutes   = require('./routes/activity');
const adminRoutes      = require('./routes/admin');

const { startSimulation } = require('./simulation/engine');
const pool = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/materials',  materialRoutes);
app.use('/api/locations',  locationRoutes);
app.use('/api/machines',   machineRoutes);
app.use('/api/inventory',  inventoryRoutes);
app.use('/api/tasks',      taskRoutes);
app.use('/api/logs',       logRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/activity',   activityRoutes);
app.use('/api/admin',      adminRoutes);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: true, message: err.message });
});

async function ensureSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_events (
        id          SERIAL PRIMARY KEY,
        event_type  VARCHAR(60) NOT NULL,
        user_id     INTEGER REFERENCES users(id),
        description TEXT NOT NULL,
        timestamp   TIMESTAMP DEFAULT NOW()
      )
    `);
    // Actualiza intervalos si siguen con valores muy cortos del seed antiguo
    await pool.query(`
      UPDATE simulation_config
      SET interval_machine_request_sec = 300,
          interval_relocate_sec        = 300,
          interval_user_action_sec     = 60
      WHERE id = 1
        AND interval_machine_request_sec < 60
    `);
    // Solo inserta el evento de inicio si no hay ninguno en las últimas 2 horas
    const { rows: recent } = await pool.query(
      `SELECT id FROM system_events WHERE event_type='system' AND timestamp > NOW() - INTERVAL '2 hours' LIMIT 1`
    );
    if (!recent.length) {
      await pool.query(
        `INSERT INTO system_events (event_type, description) VALUES ('system', 'Sistema AUTO-TASKY iniciado')`
      );
    }
    console.log('✅ Schema verificado (system_events OK).');
  } catch (err) {
    console.error('⚠️  ensureSchema:', err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`AUTO-TASKY backend corriendo en http://localhost:${PORT}`);
  await ensureSchema();
  startSimulation();
});

module.exports = app;
