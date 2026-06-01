CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('peon_almacen', 'jefe_zona', 'admin');
CREATE TYPE location_type AS ENUM ('almacen_slot', 'entrada_maquina', 'salida_maquina', 'trituradora');
CREATE TYPE machine_status AS ENUM ('idle', 'processing', 'waiting_input', 'output_ready');
CREATE TYPE material_unit AS ENUM ('kg', 'unidades', 'litros');
CREATE TYPE task_type AS ENUM ('enviar_materia_prima', 'ubicar_elemento', 'eliminar_residuo');
CREATE TYPE task_status AS ENUM ('sin_asignar', 'asignada', 'en_proceso', 'pausada', 'completada');

-- Users
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50) UNIQUE NOT NULL,
  pin_hash   VARCHAR(255) NOT NULL,
  role       user_role NOT NULL,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Materials
CREATE TABLE IF NOT EXISTS materials (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  unit        material_unit NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Machines (defined before locations due to FK)
CREATE TABLE IF NOT EXISTS machines (
  id                   SERIAL PRIMARY KEY,
  name                 VARCHAR(100) UNIQUE NOT NULL,
  type                 VARCHAR(100),
  status               machine_status DEFAULT 'idle',
  input_material_id    INTEGER REFERENCES materials(id),
  input_quantity       NUMERIC(10,2) DEFAULT 0,
  output_material_id   INTEGER REFERENCES materials(id),
  output_quantity      NUMERIC(10,2) DEFAULT 0,
  processing_time_sec  INTEGER DEFAULT 60,
  active               BOOLEAN DEFAULT true,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  type        location_type NOT NULL,
  machine_id  INTEGER REFERENCES machines(id),
  description TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id          SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id),
  material_id INTEGER NOT NULL REFERENCES materials(id),
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_id, material_id)
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id                      SERIAL PRIMARY KEY,
  type                    task_type NOT NULL,
  status                  task_status DEFAULT 'sin_asignar',
  origin_location_id      INTEGER NOT NULL REFERENCES locations(id),
  destination_location_id INTEGER NOT NULL REFERENCES locations(id),
  material_id             INTEGER NOT NULL REFERENCES materials(id),
  quantity                NUMERIC(10,2) NOT NULL,
  assigned_user_id        INTEGER REFERENCES users(id),
  created_by_user_id      INTEGER REFERENCES users(id),
  pause_reason            TEXT,
  is_simulation           BOOLEAN DEFAULT false,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW(),
  started_at              TIMESTAMP,
  paused_at               TIMESTAMP,
  completed_at            TIMESTAMP
);

-- Task history
CREATE TABLE IF NOT EXISTS task_history (
  id          SERIAL PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id),
  from_status VARCHAR(30),
  to_status   VARCHAR(30) NOT NULL,
  note        TEXT,
  timestamp   TIMESTAMP DEFAULT NOW()
);

-- System events (actividad global)
CREATE TABLE IF NOT EXISTS system_events (
  id          SERIAL PRIMARY KEY,
  event_type  VARCHAR(60) NOT NULL,
  user_id     INTEGER REFERENCES users(id),
  description TEXT NOT NULL,
  timestamp   TIMESTAMP DEFAULT NOW()
);

-- Simulation config (single row)
CREATE TABLE IF NOT EXISTS simulation_config (
  id                            INTEGER PRIMARY KEY DEFAULT 1,
  active                        BOOLEAN DEFAULT false,
  interval_machine_request_sec  INTEGER DEFAULT 300,
  interval_relocate_sec         INTEGER DEFAULT 300,
  interval_user_action_sec      INTEGER DEFAULT 60
);

INSERT INTO simulation_config (id) VALUES (1) ON CONFLICT DO NOTHING;
