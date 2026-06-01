-- Users (PINs: admin=0000, jefe1=1111, peon1=2222, peon2=3333)
-- Hashes generados con bcrypt rounds=10, se insertan via seed.js (no SQL directo)

-- Materials
INSERT INTO materials (name, unit, description) VALUES
  ('Acero', 'kg', 'Acero en bruto para prensado'),
  ('Plástico PET', 'kg', 'Plástico PET para compactación'),
  ('Aluminio', 'kg', 'Aluminio en lingotes'),
  ('Residuo Metálico', 'kg', 'Residuo generado por prensa y compactadora')
ON CONFLICT (name) DO NOTHING;

-- Machines
INSERT INTO machines (name, type, input_material_id, output_material_id, processing_time_sec) VALUES
  ('Máquina 1 - Prensa',       'Prensa hidráulica',
   (SELECT id FROM materials WHERE name='Acero'),
   (SELECT id FROM materials WHERE name='Residuo Metálico'), 60),
  ('Máquina 2 - Compactadora', 'Compactadora industrial',
   (SELECT id FROM materials WHERE name='Plástico PET'),
   (SELECT id FROM materials WHERE name='Residuo Metálico'), 45)
ON CONFLICT (name) DO NOTHING;

-- Locations
INSERT INTO locations (name, type, machine_id) VALUES
  ('Slot A1', 'almacen_slot', NULL),
  ('Slot A2', 'almacen_slot', NULL),
  ('Slot A3', 'almacen_slot', NULL),
  ('Slot B1', 'almacen_slot', NULL),
  ('Slot B2', 'almacen_slot', NULL),
  ('Entrada Máquina 1', 'entrada_maquina', (SELECT id FROM machines WHERE name='Máquina 1 - Prensa')),
  ('Entrada Máquina 2', 'entrada_maquina', (SELECT id FROM machines WHERE name='Máquina 2 - Compactadora')),
  ('Salida Máquina 1',  'salida_maquina',  (SELECT id FROM machines WHERE name='Máquina 1 - Prensa')),
  ('Salida Máquina 2',  'salida_maquina',  (SELECT id FROM machines WHERE name='Máquina 2 - Compactadora')),
  ('Trituradora Principal', 'trituradora', NULL)
ON CONFLICT (name) DO NOTHING;

-- Inventory inicial
INSERT INTO inventory (location_id, material_id, quantity)
SELECT l.id, m.id, 200 FROM locations l, materials m
WHERE l.name='Slot A1' AND m.name='Acero'
ON CONFLICT (location_id, material_id) DO NOTHING;

INSERT INTO inventory (location_id, material_id, quantity)
SELECT l.id, m.id, 150 FROM locations l, materials m
WHERE l.name='Slot A2' AND m.name='Plástico PET'
ON CONFLICT (location_id, material_id) DO NOTHING;

INSERT INTO inventory (location_id, material_id, quantity)
SELECT l.id, m.id, 100 FROM locations l, materials m
WHERE l.name='Slot B1' AND m.name='Aluminio'
ON CONFLICT (location_id, material_id) DO NOTHING;
