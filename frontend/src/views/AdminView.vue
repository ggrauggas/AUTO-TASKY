<template>
  <div class="page">
    <div class="topbar"><h1>Administración</h1></div>
    <div class="page" style="padding-top:20px">
      <div class="tabs">
        <button v-for="tab in tabs" :key="tab.key" :class="['tab-btn', active===tab.key?'active':'']" @click="active=tab.key">{{ tab.label }}</button>
      </div>

      <!-- SIMULACIÓN -->
      <div v-if="active==='sim'">
        <div class="card mb-4">
          <div class="flex-between mb-4">
            <div>
              <div style="font-size:1rem;font-weight:700;color:#fff">Motor de simulación</div>
              <div style="font-size:.8rem;color:rgba(255,255,255,.6);margin-top:2px">
                Al activar, genera tareas y las completa automáticamente con usuarios simulados
              </div>
            </div>
            <div class="toggle-wrap">
              <button :class="['toggle', sim.active?'on':'']" @click="toggleSim"></button>
              <span style="font-weight:700;color:#fff">{{ sim.active ? 'ACTIVA' : 'INACTIVA' }}</span>
            </div>
          </div>
          <div v-if="sim.config" class="grid-3" style="gap:16px;margin-bottom:16px">
            <div class="form-group" style="margin:0">
              <label style="color:rgba(255,255,255,.7)">Intervalo nuevas tareas (seg)</label>
              <input type="number" v-model.number="simCfg.interval_machine_request_sec" min="5" />
            </div>
            <div class="form-group" style="margin:0">
              <label style="color:rgba(255,255,255,.7)">Intervalo reubicaciones (seg)</label>
              <input type="number" v-model.number="simCfg.interval_relocate_sec" min="5" />
            </div>
            <div class="form-group" style="margin:0">
              <label style="color:rgba(255,255,255,.7)">Intervalo acción usuario (seg)</label>
              <input type="number" v-model.number="simCfg.interval_user_action_sec" min="5" />
            </div>
          </div>
          <button class="btn btn-white btn-sm" @click="saveCfg">Guardar intervalos</button>
        </div>

        <!-- Botón de limpieza -->
        <div class="card card-dark">
          <div style="margin-bottom:14px">
            <div style="font-size:1rem;font-weight:700;color:#fff">Limpiar sistema</div>
            <div style="font-size:.82rem;color:rgba(255,255,255,.55);margin-top:4px;line-height:1.5">
              Elimina todas las tareas, historial y actividad. Resetea el inventario a los valores iniciales y las máquinas a estado inactivo.
              Conserva usuarios, máquinas, ubicaciones y materiales.
            </div>
          </div>
          <button class="btn btn-danger" :disabled="cleaning" @click="showResetConfirm=true">
            <span v-if="cleaning" class="spinner"></span>
            <span v-else>Limpiar todos los datos operativos</span>
          </button>
        </div>

        <!-- Confirm reset -->
        <div v-if="showResetConfirm" class="modal-backdrop" @click.self="showResetConfirm=false">
          <div class="modal">
            <div class="modal-header" style="background:var(--danger)">
              <div class="modal-title">Confirmar limpieza del sistema</div>
            </div>
            <div class="modal-body">
              <p style="color:var(--text-sub);font-size:.95rem;line-height:1.6">
                Esta acción eliminará <strong>todas las tareas</strong>, el historial de tarea, el log de actividad y reseteará el inventario.<br><br>
                Se conservarán: usuarios, máquinas, ubicaciones y materiales.<br><br>
                <strong style="color:var(--danger)">Esta acción no se puede deshacer.</strong>
              </p>
            </div>
            <div class="modal-actions">
              <button class="btn btn-ghost btn-sm" @click="showResetConfirm=false">Cancelar</button>
              <button class="btn btn-danger btn-sm" @click="doReset">Sí, limpiar todo</button>
            </div>
          </div>
        </div>
      </div>

      <!-- USUARIOS -->
      <div v-if="active==='users'">
        <div class="flex-between mb-4">
          <span class="section-title" style="margin:0">Usuarios</span>
          <button class="btn btn-primary btn-sm" @click="userModal={username:'',pin:'',role:'peon_almacen'}">+ Nuevo</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Usuario</th><th>Rol</th><th>Activo</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr v-for="u in usersData" :key="u.id">
                <td>{{ u.id }}</td><td>{{ u.username }}</td>
                <td>{{ u.role }}</td>
                <td><span :class="`badge badge-${u.active?'en_proceso':'pausada'}`">{{ u.active?'Sí':'No' }}</span></td>
                <td>
                  <button class="btn btn-ghost btn-sm" @click="userModal={...u,pin:''}">Editar</button>
                  <button class="btn btn-danger btn-sm" @click="deactivateUser(u)" style="margin-left:6px">Desactivar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="userModal" class="modal-backdrop" @click.self="userModal=null">
          <div class="modal">
            <div class="modal-title">{{ userModal.id ? 'Editar usuario' : 'Nuevo usuario' }}</div>
            <div class="form-group"><label>Username</label><input v-model="userModal.username" /></div>
            <div class="form-group"><label>PIN (4 dígitos, dejar vacío para no cambiar)</label><input v-model="userModal.pin" maxlength="4" placeholder="----" /></div>
            <div class="form-group"><label>Rol</label>
              <select v-model="userModal.role">
                <option value="peon_almacen">Peón de almacén</option>
                <option value="jefe_zona">Jefe de zona</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="userModal=null">Cancelar</button>
              <button class="btn btn-primary" @click="saveUser">Guardar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- MATERIALES -->
      <div v-if="active==='materials'">
        <div class="flex-between mb-4">
          <span class="section-title" style="margin:0">Materiales</span>
          <button class="btn btn-primary btn-sm" @click="matModal={name:'',unit:'kg',description:''}">+ Nuevo</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Nombre</th><th>Unidad</th><th>Descripción</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr v-for="m in matsData" :key="m.id">
                <td>{{ m.id }}</td><td>{{ m.name }}</td><td>{{ m.unit }}</td><td class="text-muted">{{ m.description }}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" @click="matModal={...m}">Editar</button>
                  <button class="btn btn-danger btn-sm" @click="deleteMat(m)" style="margin-left:6px">Eliminar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="matModal" class="modal-backdrop" @click.self="matModal=null">
          <div class="modal">
            <div class="modal-title">{{ matModal.id ? 'Editar material' : 'Nuevo material' }}</div>
            <div class="form-group"><label>Nombre</label><input v-model="matModal.name" /></div>
            <div class="form-group"><label>Unidad</label>
              <select v-model="matModal.unit"><option>kg</option><option>unidades</option><option>litros</option></select>
            </div>
            <div class="form-group"><label>Descripción</label><input v-model="matModal.description" /></div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="matModal=null">Cancelar</button>
              <button class="btn btn-primary" @click="saveMat">Guardar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- UBICACIONES -->
      <div v-if="active==='locations'">
        <div class="flex-between mb-4">
          <span class="section-title" style="margin:0">Ubicaciones</span>
          <button class="btn btn-primary btn-sm" @click="locModal={name:'',type:'almacen_slot',machine_id:null,description:''}">+ Nueva</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Nombre</th><th>Tipo</th><th>Máquina</th><th>Activa</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr v-for="l in locsData" :key="l.id">
                <td>{{ l.id }}</td><td>{{ l.name }}</td><td>{{ l.type }}</td>
                <td>{{ l.machine_name || '—' }}</td>
                <td><span :class="`badge badge-${l.active?'en_proceso':'pausada'}`">{{ l.active?'Sí':'No' }}</span></td>
                <td>
                  <button class="btn btn-ghost btn-sm" @click="locModal={...l}">Editar</button>
                  <button class="btn btn-danger btn-sm" @click="deactivateLoc(l)" style="margin-left:6px">Desactivar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="locModal" class="modal-backdrop" @click.self="locModal=null">
          <div class="modal">
            <div class="modal-title">{{ locModal.id ? 'Editar ubicación' : 'Nueva ubicación' }}</div>
            <div class="form-group"><label>Nombre</label><input v-model="locModal.name" /></div>
            <div class="form-group"><label>Tipo</label>
              <select v-model="locModal.type">
                <option value="almacen_slot">Slot almacén</option>
                <option value="entrada_maquina">Entrada máquina</option>
                <option value="salida_maquina">Salida máquina</option>
                <option value="trituradora">Trituradora</option>
              </select>
            </div>
            <div v-if="['entrada_maquina','salida_maquina'].includes(locModal.type)" class="form-group">
              <label>Máquina asociada</label>
              <select v-model="locModal.machine_id">
                <option :value="null">— Ninguna —</option>
                <option v-for="m in machsData" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </div>
            <div class="form-group"><label>Descripción</label><input v-model="locModal.description" /></div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="locModal=null">Cancelar</button>
              <button class="btn btn-primary" @click="saveLoc">Guardar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- MÁQUINAS -->
      <div v-if="active==='machines'">
        <div class="flex-between mb-4">
          <span class="section-title" style="margin:0">Máquinas</span>
          <button class="btn btn-primary btn-sm" @click="machModal={name:'',type:'',input_material_id:null,output_material_id:null,processing_time_sec:60}">+ Nueva</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Nombre</th><th>Tipo</th><th>Material entrada</th><th>Material salida</th><th>Tiempo (s)</th><th>Activa</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr v-for="m in machsData" :key="m.id">
                <td>{{ m.id }}</td><td>{{ m.name }}</td><td>{{ m.type }}</td>
                <td>{{ m.input_material_name || '—' }}</td>
                <td>{{ m.output_material_name || '—' }}</td>
                <td>{{ m.processing_time_sec }}</td>
                <td><span :class="`badge badge-${m.active?'en_proceso':'pausada'}`">{{ m.active?'Sí':'No' }}</span></td>
                <td>
                  <button class="btn btn-ghost btn-sm" @click="machModal={...m}">Editar</button>
                  <button class="btn btn-danger btn-sm" @click="deactivateMach(m)" style="margin-left:6px">Desactivar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="machModal" class="modal-backdrop" @click.self="machModal=null">
          <div class="modal">
            <div class="modal-title">{{ machModal.id ? 'Editar máquina' : 'Nueva máquina' }}</div>
            <div class="form-group"><label>Nombre</label><input v-model="machModal.name" /></div>
            <div class="form-group"><label>Tipo</label><input v-model="machModal.type" /></div>
            <div class="form-group"><label>Material de entrada</label>
              <select v-model="machModal.input_material_id">
                <option :value="null">— Ninguno —</option>
                <option v-for="m in matsData" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </div>
            <div class="form-group"><label>Material de salida</label>
              <select v-model="machModal.output_material_id">
                <option :value="null">— Ninguno —</option>
                <option v-for="m in matsData" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </div>
            <div class="form-group"><label>Tiempo de procesado (segundos)</label><input type="number" v-model.number="machModal.processing_time_sec" min="1" /></div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="machModal=null">Cancelar</button>
              <button class="btn btn-primary" @click="saveMach">Guardar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { users as usersApi, materials as matsApi, locations as locsApi, machines as machsApi, simulation as simApi, admin as adminApi } from '@/api/index'
import { useSimulationStore } from '@/stores/simulation'
import { useUIStore } from '@/stores/ui'

const ui             = useUIStore()
const simStore       = useSimulationStore()
const showResetConfirm = ref(false)
const cleaning         = ref(false)

const tabs = [
  { key:'sim',       label:'Simulación' },
  { key:'users',     label:'Usuarios' },
  { key:'materials', label:'Materiales' },
  { key:'locations', label:'Ubicaciones' },
  { key:'machines',  label:'Máquinas' },
]
const active = ref('sim')

// Simulation
const sim    = simStore
const simCfg = reactive({ interval_machine_request_sec:300, interval_relocate_sec:300, interval_user_action_sec:60 })

async function toggleSim() { await simStore.toggle() }
async function saveCfg()   { await simStore.saveConfig(simCfg); ui.success('Configuración guardada.') }

async function doReset() {
  showResetConfirm.value = false
  cleaning.value = true
  try {
    await adminApi.reset()
    ui.success('Sistema limpiado. Inventario restaurado a valores iniciales.')
    await loadAll()
  } catch(e) {
    ui.error(e.response?.data?.message || 'Error al limpiar el sistema.')
  } finally {
    cleaning.value = false
  }
}

// Data
const usersData = ref([])
const matsData  = ref([])
const locsData  = ref([])
const machsData = ref([])

const userModal = ref(null)
const matModal  = ref(null)
const locModal  = ref(null)
const machModal = ref(null)

async function loadAll() {
  await simStore.fetch()
  if (simStore.config) {
    simCfg.interval_machine_request_sec = simStore.config.interval_machine_request_sec
    simCfg.interval_relocate_sec        = simStore.config.interval_relocate_sec
    simCfg.interval_user_action_sec     = simStore.config.interval_user_action_sec
  }
  const [u, m, l, ma] = await Promise.all([usersApi.list(), matsApi.list(), locsApi.list(), machsApi.list()])
  usersData.value = u.data
  matsData.value  = m.data
  locsData.value  = l.data
  machsData.value = ma.data
}

// Users
async function saveUser() {
  try {
    const d = { username: userModal.value.username, role: userModal.value.role }
    if (userModal.value.pin) d.pin = userModal.value.pin
    if (userModal.value.id) await usersApi.update(userModal.value.id, d)
    else await usersApi.create({ ...d, pin: userModal.value.pin })
    ui.success('Usuario guardado.'); userModal.value=null; loadAll()
  } catch(e){ ui.error(e.response?.data?.message||'Error') }
}
async function deactivateUser(u) {
  try { await usersApi.remove(u.id); ui.success('Desactivado.'); loadAll() }
  catch(e){ ui.error(e.response?.data?.message||'Error') }
}

// Materials
async function saveMat() {
  try {
    if (matModal.value.id) await matsApi.update(matModal.value.id, matModal.value)
    else await matsApi.create(matModal.value)
    ui.success('Material guardado.'); matModal.value=null; loadAll()
  } catch(e){ ui.error(e.response?.data?.message||'Error') }
}
async function deleteMat(m) {
  try { await matsApi.remove(m.id); ui.success('Eliminado.'); loadAll() }
  catch(e){ ui.error(e.response?.data?.message||'Error') }
}

// Locations
async function saveLoc() {
  try {
    if (locModal.value.id) await locsApi.update(locModal.value.id, locModal.value)
    else await locsApi.create(locModal.value)
    ui.success('Ubicación guardada.'); locModal.value=null; loadAll()
  } catch(e){ ui.error(e.response?.data?.message||'Error') }
}
async function deactivateLoc(l) {
  try { await locsApi.remove(l.id); ui.success('Desactivada.'); loadAll() }
  catch(e){ ui.error(e.response?.data?.message||'Error') }
}

// Machines
async function saveMach() {
  try {
    if (machModal.value.id) await machsApi.update(machModal.value.id, machModal.value)
    else await machsApi.create(machModal.value)
    ui.success('Máquina guardada.'); machModal.value=null; loadAll()
  } catch(e){ ui.error(e.response?.data?.message||'Error') }
}
async function deactivateMach(m) {
  try { await machsApi.remove(m.id); ui.success('Desactivada.'); loadAll() }
  catch(e){ ui.error(e.response?.data?.message||'Error') }
}

onMounted(loadAll)
</script>
