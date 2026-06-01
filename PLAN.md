# AUTO-TASKY — Plan de Software Completo

## 1. Visión General

Sistema de gestión de tareas para maquinaria industrial de almacén. Permite crear, asignar y
seguir tareas relacionadas con el movimiento de materiales entre ubicaciones y máquinas. Incluye
un modo de simulación automática que genera actividad ficticia para demostrar el flujo completo
del sistema.

---

## 2. Stack Tecnológico

| Capa         | Tecnología                              |
|--------------|-----------------------------------------|
| Frontend     | Vue 3 + Pinia + Vue Router + Axios      |
| Backend      | Node.js + Express                       |
| Base de datos| PostgreSQL                              |
| Simulación   | Cron jobs en backend (node-cron)        |
| Auth         | JWT (jsonwebtoken) + bcrypt para el PIN |

> n8n eliminado: la simulación la gestiona el propio backend con node-cron.

---

## 3. Roles y Tabla de Permisos

| Acción                                  | Peón de almacén | Jefe de zona | Admin |
|-----------------------------------------|:---------------:|:------------:|:-----:|
| Ver tareas pendientes / sin asignar     | ✅              | ✅           | ✅    |
| Tomar una tarea sin asignar             | ✅              | ✅           | ✅    |
| Cambiar estado de su propia tarea       | ✅              | ✅           | ✅    |
| Crear tareas                            | ❌              | ✅           | ✅    |
| Editar cualquier tarea                  | ❌              | ✅           | ✅    |
| Asignar tarea a un usuario              | ❌              | ✅           | ✅    |
| Cancelar / eliminar tareas              | ❌              | ❌           | ✅    |
| Panel de maquinaria (crear/editar)      | solo ver        | ✅           | ✅    |
| CRUD usuarios / máquinas / ubicaciones  | ❌              | ❌           | ✅    |
| CRUD materiales                         | ❌              | ❌           | ✅    |
| Ajuste manual de inventario             | ❌              | ❌           | ✅    |
| Activar / desactivar simulación         | ❌              | ❌           | ✅    |
| Configurar parámetros de simulación     | ❌              | ❌           | ✅    |

---

## 4. Esquema de Base de Datos

### 4.1 Tabla `users`
```
id            SERIAL PRIMARY KEY
username      VARCHAR(50) UNIQUE NOT NULL
pin_hash      VARCHAR(255) NOT NULL          -- bcrypt del PIN de 4 dígitos
role          ENUM('peon_almacen','jefe_zona','admin') NOT NULL
active        BOOLEAN DEFAULT true
created_at    TIMESTAMP DEFAULT NOW()
```

### 4.2 Tabla `materials`
```
id            SERIAL PRIMARY KEY
name          VARCHAR(100) UNIQUE NOT NULL   -- ej: "Acero", "Plástico PET"
unit          ENUM('kg','unidades','litros') NOT NULL
description   TEXT
created_at    TIMESTAMP DEFAULT NOW()
```

### 4.3 Tabla `location_types` (enum en DB o constante)
Valores posibles: `almacen_slot`, `entrada_maquina`, `salida_maquina`, `trituradora`

### 4.4 Tabla `locations`
```
id            SERIAL PRIMARY KEY
name          VARCHAR(100) UNIQUE NOT NULL   -- ej: "Slot A1", "Entrada Máquina 1"
type          ENUM('almacen_slot','entrada_maquina','salida_maquina','trituradora') NOT NULL
machine_id    INTEGER REFERENCES machines(id) NULL  -- solo si type es entrada/salida_maquina
description   TEXT
active        BOOLEAN DEFAULT true
created_at    TIMESTAMP DEFAULT NOW()
```

### 4.5 Tabla `machines`
```
id            SERIAL PRIMARY KEY
name          VARCHAR(100) UNIQUE NOT NULL   -- ej: "Máquina 1 - Prensa"
type          VARCHAR(100)                   -- ej: "Prensa hidráulica"
status        ENUM('idle','processing','waiting_input','output_ready') DEFAULT 'idle'
input_material_id   INTEGER REFERENCES materials(id) NULL
input_quantity      NUMERIC(10,2) DEFAULT 0
output_material_id  INTEGER REFERENCES materials(id) NULL
output_quantity     NUMERIC(10,2) DEFAULT 0
processing_time_sec INTEGER DEFAULT 60      -- segundos que tarda en procesar
active        BOOLEAN DEFAULT true
created_at    TIMESTAMP DEFAULT NOW()
updated_at    TIMESTAMP DEFAULT NOW()
```
> `input_material_id` y `output_material_id` pueden ser el mismo (ej: compactar metal)
> o distintos (ej: plástico crudo → pellets).

### 4.6 Tabla `inventory`
```
id            SERIAL PRIMARY KEY
location_id   INTEGER REFERENCES locations(id) NOT NULL
material_id   INTEGER REFERENCES materials(id) NOT NULL
quantity      NUMERIC(10,2) NOT NULL DEFAULT 0
updated_at    TIMESTAMP DEFAULT NOW()
UNIQUE(location_id, material_id)
```

### 4.7 Tabla `tasks`
```
id                    SERIAL PRIMARY KEY
type                  ENUM('enviar_materia_prima','ubicar_elemento','eliminar_residuo') NOT NULL
status                ENUM('sin_asignar','asignada','en_proceso','pausada','completada') DEFAULT 'sin_asignar'
origin_location_id    INTEGER REFERENCES locations(id) NOT NULL
destination_location_id INTEGER REFERENCES locations(id) NOT NULL
material_id           INTEGER REFERENCES materials(id) NOT NULL
quantity              NUMERIC(10,2) NOT NULL
assigned_user_id      INTEGER REFERENCES users(id) NULL
created_by_user_id    INTEGER REFERENCES users(id) NULL   -- NULL si la genera la simulación
pause_reason          TEXT NULL
is_simulation         BOOLEAN DEFAULT false
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP DEFAULT NOW()
started_at            TIMESTAMP NULL
paused_at             TIMESTAMP NULL
completed_at          TIMESTAMP NULL
```

### 4.8 Tabla `task_history`
Registro de cada cambio de estado de una tarea.
```
id            SERIAL PRIMARY KEY
task_id       INTEGER REFERENCES tasks(id) NOT NULL
user_id       INTEGER REFERENCES users(id) NULL
from_status   VARCHAR(30)
to_status     VARCHAR(30) NOT NULL
note          TEXT NULL                      -- motivo de pausa u otros comentarios
timestamp     TIMESTAMP DEFAULT NOW()
```

### 4.9 Tabla `simulation_config`
Una sola fila (id = 1), sin inserts adicionales.
```
id                          INTEGER PRIMARY KEY DEFAULT 1
active                      BOOLEAN DEFAULT false
interval_machine_request_sec  INTEGER DEFAULT 30   -- cada cuánto una máquina pide material
interval_relocate_sec         INTEGER DEFAULT 45   -- cada cuánto se crea tarea de ubicación
interval_user_action_sec      INTEGER DEFAULT 20   -- cada cuánto un usuario simulado actúa
```

---

## 5. Flujo de Estados de una Tarea

```
[CREACIÓN]
     │
     ▼
 sin_asignar  ◄─── cualquier usuario puede tomarla (se asigna a sí mismo)
     │               o jefe/admin la asigna a alguien
     ▼
  asignada    ◄─── usuario asignado ve la tarea en su lista
     │
     ▼
 en_proceso   ◄─── el usuario pulsa "Iniciar"
     │    ▲
     │    │         el usuario pulsa "Reanudar"
     ▼    │
  pausada  ─────── el usuario pulsa "Pausar" → dialog obligatorio con motivo escrito
     │
     ▼
 completada  ◄─── el usuario pulsa "Completar"
                   → se actualiza inventario en este momento
```

**Reglas adicionales:**
- Solo el usuario asignado (o jefe/admin) puede cambiar el estado de una tarea.
- Un peón no puede asignarse más de N tareas en estado `asignada` o `en_proceso`
  simultáneamente (N configurable, por defecto 3). Esto lo valida el backend.
- Al completar una tarea, el backend deduce la cantidad del inventario de origen y
  la suma al inventario de destino de forma atómica (transacción SQL).

---

## 6. Tipos de Tarea y Validaciones

### 6.1 Enviar Materia Prima a Maquinaria
- **Origen**: `almacen_slot`
- **Destino**: `entrada_maquina`
- **Validaciones al crear**:
  - El inventario de origen tiene `quantity >= cantidad_pedida`.
  - La máquina destino acepta ese material (`machine.input_material_id = material_id`).
  - La máquina está en estado `waiting_input` o `idle`.
  - No existe ya otra tarea activa (no completada) para esa misma entrada de máquina.
- **Al completar**:
  - `inventory[origen] -= cantidad`
  - `inventory[destino] += cantidad`
  - `machine.input_quantity += cantidad`
  - Si `machine.input_quantity >= umbral_proceso` → `machine.status = 'processing'`
  - Inicia timer interno en backend (`setTimeout`) para simular el procesado. Al expirar:
    - `machine.status = 'output_ready'`
    - `machine.output_quantity += resultado`
    - Actualiza `inventory[salida_maquina]`

### 6.2 Ubicar Elemento en Almacén
- **Origen**: cualquier tipo de ubicación con inventario
- **Destino**: `almacen_slot`
- **Validaciones al crear**:
  - El inventario de origen tiene `quantity >= cantidad_pedida`.
  - El destino es de tipo `almacen_slot` y está activo.
- **Al completar**:
  - `inventory[origen] -= cantidad`
  - `inventory[destino] += cantidad`

### 6.3 Eliminación de Residuos en Trituradora
- **Origen**: `salida_maquina`
- **Destino**: `trituradora`
- **Validaciones al crear**:
  - La máquina origen tiene `output_quantity >= cantidad_pedida`.
  - El destino es de tipo `trituradora`.
- **Al completar**:
  - `inventory[origen] -= cantidad`
  - `machine.output_quantity -= cantidad`
  - Si `machine.output_quantity <= 0` → `machine.status = 'idle'`
  - El material en trituradora se destruye (no se acumula inventario en ella).

---

## 7. Sistema de Simulación

Gestionado por el backend con **node-cron** (o `setInterval`). El estado activo/inactivo
y los intervalos se leen de `simulation_config` en cada tick (no hace falta reiniciar).

### 7.1 Generación automática de tareas
**Cada `interval_machine_request_sec` segundos:**
- Consulta máquinas con `status = 'waiting_input'` o `idle` sin tarea activa pendiente.
- Para cada una, crea una tarea `enviar_materia_prima` desde el almacén con más
  cantidad de ese material hacia la entrada de la máquina.

**Cada `interval_relocate_sec` segundos:**
- Elige un material y una ubicación de origen aleatoria con `quantity > 0`.
- Elige un `almacen_slot` destino aleatorio (distinto del origen).
- Crea tarea `ubicar_elemento` con cantidad aleatoria (entre 1 y la disponible).

**Cuando `machine.status` cambia a `output_ready` (por el timer de procesado):**
- Crea automáticamente tarea `eliminar_residuo` para esa máquina.

### 7.2 Acciones automáticas de usuarios simulados
**Cada `interval_user_action_sec` segundos:**
- Elige aleatoriamente una tarea `sin_asignar` y la asigna a un usuario `peon_almacen`
  aleatorio (marcada como `is_simulation = true`).
- Unos segundos después la pasa a `en_proceso`.
- Con una probabilidad del 20%, la pausa con un motivo genérico.
- Finalmente la completa.

### 7.3 Control desde el frontend (admin)
- Toggle ON/OFF visible en la vista Admin.
- Sliders o campos numéricos para ajustar los tres intervalos.
- Los cambios se guardan en `simulation_config` y el backend los lee en el próximo tick.

---

## 8. API REST

Prefijo base: `/api`
Auth: header `Authorization: Bearer <jwt>` en todas las rutas protegidas.

### 8.1 Auth
```
POST   /auth/login          body: { username, pin }  → { token, user }
POST   /auth/logout         (invalida token en blacklist en memoria)
GET    /auth/me             → datos del usuario autenticado
```

### 8.2 Users  (admin: CUD | todos: GET propio)
```
GET    /users               → lista (admin ve todos, otros solo ellos mismos)
GET    /users/:id
POST   /users               admin only  body: { username, pin, role }
PUT    /users/:id           admin only
DELETE /users/:id           admin only  (soft delete: active = false)
```

### 8.3 Materials  (admin: CUD | todos: GET)
```
GET    /materials
GET    /materials/:id
POST   /materials           admin only
PUT    /materials/:id       admin only
DELETE /materials/:id       admin only
```

### 8.4 Locations  (admin: CUD | todos: GET)
```
GET    /locations           ?type=almacen_slot|entrada_maquina|...
GET    /locations/:id
POST   /locations           admin only
PUT    /locations/:id       admin only
DELETE /locations/:id       admin only  (soft delete)
```

### 8.5 Machines  (admin: CUD | jefe+admin: PUT status | todos: GET)
```
GET    /machines
GET    /machines/:id
POST   /machines            admin only
PUT    /machines/:id        admin only
DELETE /machines/:id        admin only  (soft delete)
```

### 8.6 Inventory  (admin: ajuste manual | todos: GET)
```
GET    /inventory                     → todo el inventario
GET    /inventory/location/:id        → inventario de una ubicación
PUT    /inventory/adjust              admin only  body: { location_id, material_id, quantity }
```

### 8.7 Tasks
```
GET    /tasks               ?status=...&type=...&assigned_user_id=...&page=1&limit=20
GET    /tasks/:id
POST   /tasks               jefe + admin  body: { type, origin_location_id, destination_location_id, material_id, quantity, assigned_user_id? }
PUT    /tasks/:id           jefe + admin (edición completa mientras no esté completada)
DELETE /tasks/:id           admin only

PUT    /tasks/:id/take      peón/jefe/admin — se asigna al usuario autenticado
PUT    /tasks/:id/assign    jefe + admin  body: { user_id }
PUT    /tasks/:id/start     usuario asignado | jefe | admin
PUT    /tasks/:id/pause     usuario asignado | jefe | admin  body: { reason }
PUT    /tasks/:id/resume    usuario asignado | jefe | admin
PUT    /tasks/:id/complete  usuario asignado | jefe | admin
```

### 8.8 Task History
```
GET    /tasks/:id/history   → todos los cambios de estado de la tarea
```

### 8.9 Logs (historial completo)
```
GET    /logs                ?from=ISO&to=ISO&type=...&user_id=...&page=1&limit=50
                            → tareas completadas + info completa + duración calculada
```

### 8.10 Simulation  (admin only)
```
GET    /simulation/status
POST   /simulation/toggle
PUT    /simulation/config   body: { interval_machine_request_sec, interval_relocate_sec, interval_user_action_sec }
```

---

## 9. Frontend — Vistas y Componentes

### 9.1 Vista: Login (`/login`)
- Input de nombre de usuario (texto).
- Teclado numérico on-screen de 4 dígitos para el PIN (no teclado del sistema).
- Al autenticar, guarda el JWT en `localStorage` y redirige según el rol.

### 9.2 Vista: Dashboard (`/`)  — todos los roles
- Tarjetas de resumen:
  - Tareas sin asignar
  - Tareas en proceso
  - Tareas pausadas
  - Máquinas con output listo
- Acceso rápido a las vistas principales según el rol.
- Se actualiza con polling de 5 segundos.

### 9.3 Vista: Mis Tareas (`/my-tasks`)  — peón
- Lista de tareas asignadas al usuario autenticado.
- Filtros: estado.
- Botones de acción contextuales: Iniciar / Pausar / Reanudar / Completar.
- El botón **Pausar** abre un dialog modal con campo de texto obligatorio para el motivo.
- Polling cada 5 segundos.

### 9.4 Vista: Tareas (`/tasks`)  — jefe + admin
- Tabla de todas las tareas con columnas: ID, Tipo, Estado, Material, Cantidad,
  Origen, Destino, Asignado a, Creado.
- Filtros: estado, tipo, usuario asignado, rango de fechas.
- Paginación (20 por página).
- Botón **Nueva Tarea** → formulario en modal o panel lateral.
- Cada fila tiene acciones: Asignar, Editar, Cambiar estado, Eliminar (admin).
- Polling cada 5 segundos.

### 9.5 Vista: Panel de Maquinaria (`/machinery`)  — todos (edición solo jefe+admin)
- Tabla principal de máquinas: Nombre, Tipo, Estado (badge de color), Input actual,
  Output disponible.
- Al seleccionar una máquina, panel lateral con:
  - Tareas activas relacionadas con esa máquina.
  - Botón "Crear tarea para esta máquina" (jefe/admin).
- Segunda tabla debajo: todas las tareas con estado `sin_asignar` o `asignada` o
  `en_proceso`, ordenadas por fecha de creación.
- Polling cada 5 segundos.

### 9.6 Vista: Inventario (`/inventory`)  — todos (ajuste solo admin)
- Tabla agrupada por ubicación: Ubicación, Tipo, Material, Cantidad, Unidad.
- Buscador por nombre de ubicación o material.
- Admin puede pulsar en una celda de cantidad para editarla inline.

### 9.7 Vista: Registro / Historial (`/logs`)  — todos
- Tabla de tareas completadas con: ID, Tipo, Material, Cantidad, Origen, Destino,
  Completada por, Fecha inicio, Fecha fin, Duración total, Tiempo pausada, Motivos de pausa.
- Filtros: tipo, usuario, rango de fechas.
- Paginación.

### 9.8 Vista: Admin (`/admin`)  — solo admin
Compuesta por pestañas:

**Pestaña: Simulación**
- Toggle grande ON/OFF con estado visual claro (verde/gris).
- Tres sliders o campos numéricos: intervalo de peticiones de máquina, intervalo de
  ubicaciones, intervalo de acciones de usuario.
- Botón "Guardar configuración".
- Contador en tiempo real de tareas generadas por simulación (en esta sesión).

**Pestaña: Usuarios**
- Tabla CRUD: crear, editar (username, rol, PIN), desactivar.

**Pestaña: Materiales**
- Tabla CRUD: crear, editar (nombre, unidad), eliminar (si no tiene inventario activo).

**Pestaña: Ubicaciones**
- Tabla CRUD: crear, editar (nombre, tipo, máquina asociada si aplica), desactivar.

**Pestaña: Máquinas**
- Tabla CRUD: crear, editar (nombre, tipo, material de entrada, material de salida,
  tiempo de procesado en segundos), desactivar.

---

## 10. Componentes Reutilizables

- `TaskCard.vue` — tarjeta de tarea con badge de estado y botones de acción.
- `StatusBadge.vue` — badge con color según estado.
- `PauseDialog.vue` — modal con textarea obligatorio para el motivo de pausa.
- `TaskForm.vue` — formulario de creación/edición de tarea (compartido en modal).
- `ConfirmDialog.vue` — confirmación genérica para acciones destructivas.
- `InventoryTable.vue` — tabla de inventario reutilizable.
- `MachineStatusCard.vue` — tarjeta de estado de máquina.

---

## 11. Stores Pinia

```
useAuthStore       — token JWT, datos del usuario, login/logout
useTaskStore       — lista de tareas, filtros, acciones de estado
useMachineStore    — lista de máquinas y su estado
useInventoryStore  — inventario por ubicación
useSimulationStore — estado ON/OFF y configuración de simulación
useUIStore         — notificaciones toast, dialogs globales
```

---

## 12. Estrategia de Polling

- Cada vista que necesite datos en tiempo real usa `onMounted` / `onUnmounted` con
  `setInterval` / `clearInterval` a **5000 ms**.
- Las vistas inactivas (no montadas) no realizan peticiones.
- En caso de error de red, se muestra un banner no bloqueante "Sin conexión — reintentando…"
  y se continúa el polling.

---

## 13. Autenticación y Seguridad

- PIN de 4 dígitos almacenado con `bcrypt` (salt rounds: 10).
- JWT con expiración de **8 horas**.
- Blacklist de tokens en memoria del proceso (para logout efectivo).
- Middleware `authenticate` en todas las rutas protegidas.
- Middleware `authorize(roles[])` para control de acceso por rol.
- El frontend guarda el JWT en `localStorage` y lo incluye en cada request.
- Vue Router guards redirigen a `/login` si no hay token válido.
- Las rutas de admin en frontend verifican el rol desde el store, pero el backend es
  la fuente de verdad: nunca confiar solo en el frontend para control de acceso.

---

## 14. Manejo de Errores

### Backend
Todos los errores devuelven JSON:
```json
{ "error": true, "code": "INSUFFICIENT_INVENTORY", "message": "Cantidad insuficiente en origen" }
```
Códigos de error relevantes:
- `INSUFFICIENT_INVENTORY` — cantidad en origen menor que la pedida
- `MACHINE_NOT_ACCEPTING` — máquina no está en estado correcto
- `TASK_CONFLICT` — ya existe tarea activa para ese origen/destino
- `INVALID_TRANSITION` — cambio de estado no permitido (ej: de completada a pausada)
- `UNAUTHORIZED` — sin token o token expirado
- `FORBIDDEN` — rol insuficiente

### Frontend
- Notificaciones toast (no bloqueantes) para errores de validación y red.
- Dialogs de confirmación para acciones destructivas (eliminar, completar).
- Formularios con validación client-side antes de enviar al backend.

---

## 15. Datos Semilla (Seed)

Al iniciar por primera vez, el backend ejecuta un script de seed que inserta:

**Usuarios:**
- `admin` / PIN `0000` / rol admin
- `jefe1` / PIN `1111` / rol jefe_zona
- `peon1` / PIN `2222` / rol peon_almacen
- `peon2` / PIN `3333` / rol peon_almacen

**Materiales:** Acero (kg), Plástico PET (kg), Aluminio (kg), Residuo Metálico (kg)

**Ubicaciones:**
- Slot A1, A2, A3 (almacen_slot)
- Slot B1, B2 (almacen_slot)
- Entrada Máquina 1, Entrada Máquina 2 (entrada_maquina)
- Salida Máquina 1, Salida Máquina 2 (salida_maquina)
- Trituradora Principal (trituradora)

**Máquinas:**
- Máquina 1 — Prensa (input: Acero, output: Residuo Metálico, tiempo: 60s)
- Máquina 2 — Compactadora (input: Plástico PET, output: Residuo Metálico, tiempo: 45s)

**Inventario inicial:**
- Slot A1: Acero 200 kg
- Slot A2: Plástico PET 150 kg
- Slot B1: Aluminio 100 kg

---

## 16. Estructura de Carpetas

```
auto-tasky/
├── backend/
│   ├── src/
│   │   ├── config/         db.js, jwt.js
│   │   ├── middleware/      authenticate.js, authorize.js
│   │   ├── routes/          auth, users, tasks, machines, locations,
│   │   │                    materials, inventory, logs, simulation
│   │   ├── controllers/     (uno por recurso)
│   │   ├── services/        taskService.js, inventoryService.js,
│   │   │                    machineService.js, simulationService.js
│   │   ├── simulation/      engine.js  (node-cron + lógica de simulación)
│   │   ├── db/              schema.sql, seed.sql
│   │   └── app.js
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── router/          index.js  (guards de rol)
    │   ├── stores/          auth, tasks, machines, inventory, simulation, ui
    │   ├── views/           Login, Dashboard, MyTasks, Tasks, Machinery,
    │   │                    Inventory, Logs, Admin
    │   ├── components/      TaskCard, StatusBadge, PauseDialog, TaskForm,
    │   │                    ConfirmDialog, InventoryTable, MachineStatusCard
    │   ├── api/             axios instance + módulos por recurso
    │   └── main.js
    └── package.json
```

---

## 17. Orden de Implementación Recomendado

1. Schema SQL + seed data
2. Backend: auth + middleware de roles
3. Backend: CRUD de usuarios, materiales, ubicaciones, máquinas
4. Backend: lógica de inventario (servicio atómico)
5. Backend: CRUD de tareas + transiciones de estado con validaciones
6. Backend: motor de simulación (node-cron)
7. Frontend: login + stores base + router con guards
8. Frontend: vistas de tareas (Dashboard, MyTasks, Tasks)
9. Frontend: Panel de Maquinaria
10. Frontend: Inventario + Logs
11. Frontend: Vista Admin (CRUD + simulación)
12. Pruebas end-to-end del flujo completo con simulación activa
