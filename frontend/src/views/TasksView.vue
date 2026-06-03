<template>
  <div>
    <div class="topbar">
      <h1>Gestión de Tareas</h1>
      <button class="btn btn-primary btn-sm" @click="showForm=true">+ Nueva tarea</button>
    </div>
    <div class="page">

      <div class="filters-bar">
        <select v-model="filters.status">
          <option value="">Todos los estados</option>
          <option value="sin_asignar">Sin asignar</option>
          <option value="asignada">Asignada</option>
          <option value="en_proceso">En proceso</option>
          <option value="pausada">Pausada</option>
          <option value="completada">Completada</option>
        </select>
        <select v-model="filters.type">
          <option value="">Todos los tipos</option>
          <option value="enviar_materia_prima">Enviar materia prima</option>
          <option value="ubicar_elemento">Ubicar elemento</option>
          <option value="eliminar_residuo">Eliminar residuo</option>
        </select>
        <button class="btn btn-ghost btn-sm" @click="resetFilters">Limpiar</button>
        <span class="filters-count">{{ total }} tareas</span>
      </div>

      <div class="table-wrap">
        <table class="tasks-table">
          <thead>
            <tr>
              <th class="col-id">#</th>
              <th class="col-type">Tipo</th>
              <th class="col-status">Estado</th>
              <th>Material</th>
              <th class="col-qty">Cant.</th>
              <th class="col-route">Origen → Destino</th>
              <th class="col-user">Asignado</th>
              <th class="col-date">Fecha</th>
              <th class="col-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="9" class="td-center"><span class="spinner spinner-teal"></span></td>
            </tr>
            <tr v-else-if="!tasks.length">
              <td colspan="9">
                <div class="empty">
                  <div class="empty-title">Sin resultados</div>
                  <div class="empty-sub">Prueba cambiando los filtros</div>
                </div>
              </td>
            </tr>
            <tr v-for="t in tasks" :key="t.id"
                :class="t.status==='pausada' ? 'row-warn' : t.status==='completada' ? 'row-done' : ''">
              <td class="td-id">#{{ t.id }}</td>
              <td><span class="type-pill" :class="`type-${t.type}`">{{ typeShort(t.type) }}</span></td>
              <td><StatusBadge :status="t.status" /></td>
              <td class="td-material">{{ t.material_name }}</td>
              <td class="td-qty">{{ t.quantity }}<span class="unit">{{ t.material_unit }}</span></td>
              <td>
                <div class="td-route">
                  <span>{{ t.origin_name }}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="route-arrow"><path d="M2 6h8M7 3l3 3-3 3"/></svg>
                  <span>{{ t.destination_name }}</span>
                </div>
              </td>
              <td>
                <span v-if="t.assigned_username" class="user-name">{{ t.assigned_username }}</span>
                <span v-else class="no-user">—</span>
              </td>
              <td class="td-date">{{ fmtDate(t.created_at) }}</td>
              <td>
                <div class="actions-row">
                  <button v-if="t.status!=='completada'" class="icon-btn edit-btn" title="Editar"
                    @click="editTask=t;showForm=true">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button v-if="t.status==='sin_asignar'||t.status==='asignada'" class="icon-btn assign-btn" title="Asignar usuario"
                    @click="assignTask=t;loadUsers()">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <line x1="19" y1="8" x2="19" y2="14"/>
                      <line x1="22" y1="11" x2="16" y2="11"/>
                    </svg>
                  </button>
                  <button v-if="t.status==='sin_asignar'" class="icon-btn take-btn" title="Tomar tarea"
                    @click="changeStatus(t,'take')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                      <polyline points="16 11 18 13 22 9"/>
                    </svg>
                  </button>
                  <button v-if="t.status==='asignada'" class="icon-btn start-btn" title="Iniciar tarea"
                    @click="changeStatus(t,'start')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </button>
                  <button v-if="t.status==='en_proceso'" class="icon-btn pause-btn" title="Pausar tarea"
                    @click="pauseTask=t">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="6" y="4" width="4" height="16"/>
                      <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                  </button>
                  <button v-if="t.status==='pausada'" class="icon-btn start-btn" title="Reanudar tarea"
                    @click="changeStatus(t,'resume')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </button>
                  <button v-if="t.status==='en_proceso'||t.status==='pausada'" class="icon-btn complete-btn" title="Completar tarea"
                    @click="changeStatus(t,'complete')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                  <button v-if="auth.isAdmin" class="icon-btn delete-btn" title="Eliminar tarea"
                    @click="deleteTask=t">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <span class="pag-info">Página {{ page }} — {{ tasks.length }} de {{ total }}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" :disabled="page<=1" @click="page--;load()">← Anterior</button>
          <button class="btn btn-ghost btn-sm" :disabled="page*limit>=total" @click="page++;load()">Siguiente →</button>
        </div>
      </div>

    </div>

    <TaskForm v-if="showForm" :task="editTask" @close="showForm=false;editTask=null" @saved="showForm=false;editTask=null;load()" />
    <PauseDialog v-if="pauseTask" @confirm="doPause" @cancel="pauseTask=null" />
    <AssignDialog v-if="assignTask" :users="allUsers" @confirm="doAssign" @cancel="assignTask=null" />
    <ConfirmDialog v-if="deleteTask"
      title="Eliminar tarea" :message="`¿Seguro que quieres eliminar la tarea #${deleteTask.id}? Esta acción no se puede deshacer.`"
      confirm-text="Sí, eliminar" variant="danger"
      @confirm="doDelete" @cancel="deleteTask=null" />
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { tasks as tasksApi, users as usersApi } from '@/api/index'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import StatusBadge from '@/components/StatusBadge.vue'
import TaskForm from '@/components/TaskForm.vue'
import PauseDialog from '@/components/PauseDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AssignDialog from '@/components/AssignDialog.vue'

const auth  = useAuthStore()
const ui    = useUIStore()
const route = useRoute()
const tasks     = ref([])
const total     = ref(0)
const page      = ref(1)
const limit     = 20
const loading   = ref(false)
const showForm  = ref(false)
const editTask  = ref(null)
const pauseTask = ref(null)
const assignTask= ref(null)
const deleteTask= ref(null)
const allUsers  = ref([])
const filters   = reactive({ status: route.query.status || '', type:'' })

const TYPE_SHORT = {
  enviar_materia_prima: 'Mat. Prima',
  ubicar_elemento:      'Ubicar',
  eliminar_residuo:     'Residuo',
}
const typeShort = t => TYPE_SHORT[t] || t
const fmtDate   = d => d ? new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '—'

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true
  try {
    const p = { page: page.value, limit }
    if (filters.status) p.status = filters.status
    if (filters.type)   p.type   = filters.type
    const { data } = await tasksApi.list(p)
    if (silent) {
      if (JSON.stringify(data.data) !== JSON.stringify(tasks.value)) tasks.value = data.data
      if (data.total !== total.value) total.value = data.total
    } else {
      tasks.value = data.data
      total.value = data.total
    }
  } finally { if (!silent) loading.value = false }
}

function resetFilters() { filters.status=''; filters.type=''; page.value=1; load() }

async function loadUsers() {
  if (!allUsers.value.length) {
    const { data } = await usersApi.list()
    allUsers.value = data.filter(u => u.active)
  }
}

async function changeStatus(t, action) {
  try {
    if (action==='take')     await tasksApi.take(t.id)
    if (action==='start')    await tasksApi.start(t.id)
    if (action==='resume')   await tasksApi.resume(t.id)
    if (action==='complete') await tasksApi.complete(t.id)
    ui.success('Estado actualizado correctamente.')
    load()
  } catch(e) { ui.error(e.response?.data?.message || 'Error al cambiar estado') }
}

async function doPause(reason) {
  try { await tasksApi.pause(pauseTask.value.id, reason); ui.success('Tarea pausada.'); pauseTask.value=null; load() }
  catch(e) { ui.error(e.response?.data?.message || 'Error') }
}
async function doAssign(userId) {
  try { await tasksApi.assign(assignTask.value.id, { user_id: userId }); ui.success('Tarea asignada.'); assignTask.value=null; load() }
  catch(e) { ui.error(e.response?.data?.message || 'Error') }
}
async function doDelete() {
  try { await tasksApi.remove(deleteTask.value.id); ui.success('Tarea eliminada.'); deleteTask.value=null; load() }
  catch(e) { ui.error(e.response?.data?.message || 'Error') }
}

watch([()=>filters.status,()=>filters.type], ()=>{ page.value=1; load() })
let interval
onMounted(()=>{ load(); interval=setInterval(()=>load({ silent:true }),5000) })
onUnmounted(()=>clearInterval(interval))
</script>

<style scoped>
/* ── Filtros ── */
.filters-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 14px;
}
.filters-bar select { min-width: 150px; }
.filters-count {
  margin-left: auto;
  font-size: .8rem;
  color: var(--text-muted);
  font-weight: 600;
}

/* ── Tabla ── */
.tasks-table th,
.tasks-table td {
  padding: 6px 10px;
  font-size: .82rem;
}
.tasks-table th {
  font-size: .7rem;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.col-id      { width: 42px; }
.col-type    { width: 90px; }
.col-status  { width: 115px; }
.col-qty     { width: 72px; }
.col-route   { min-width: 200px; }
.col-user    { width: 100px; }
.col-date    { width: 76px; }
.col-actions { width: 120px; }

.td-id { font-weight: 700; color: var(--text-muted); font-size: .76rem; }
.td-material { font-weight: 600; }
.td-qty { font-weight: 700; color: var(--primary); white-space: nowrap; }
.unit { font-weight: 400; color: var(--text-muted); font-size: .74rem; margin-left: 2px; }

.td-route {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: .82rem;
  font-weight: 500;
  white-space: nowrap;
}
.route-arrow { color: var(--text-muted); flex-shrink: 0; }

.user-name { font-weight: 600; color: var(--primary); font-size: .82rem; }
.no-user   { color: var(--text-muted); }

.td-date { font-size: .76rem; color: var(--text-muted); white-space: nowrap; }
.td-center { text-align: center; padding: 32px !important; }

/* ── Rows ── */
.row-warn td { background: var(--warn-soft) !important; }
.row-done td { background: #f6fffe !important; color: var(--text-muted); }

/* ── Type pills ── */
.type-pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: .68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  white-space: nowrap;
}
.type-enviar_materia_prima { background: var(--t100); color: var(--t700); }
.type-ubicar_elemento      { background: #e0f2fe; color: #0369a1; }
.type-eliminar_residuo     { background: #fef3c7; color: #92400e; }

/* ── Botones de acción ── */
.actions-row {
  display: flex;
  gap: 3px;
  align-items: center;
  flex-wrap: nowrap;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background .12s, border-color .12s, transform .1s;
  flex-shrink: 0;
  background: none;
}
.icon-btn:hover { transform: translateY(-1px); }
.icon-btn:active { transform: translateY(0); }

.edit-btn     { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
.edit-btn:hover { background: #e2e8f0; color: #1e293b; }

.assign-btn   { background: var(--t50); color: var(--t600); border-color: var(--t200); }
.assign-btn:hover { background: var(--t100); }

.take-btn     { background: #ede9fe; color: #7c3aed; border-color: #ddd6fe; }
.take-btn:hover { background: #ddd6fe; }

.start-btn    { background: #dcfce7; color: #16a34a; border-color: #bbf7d0; }
.start-btn:hover { background: #bbf7d0; }

.pause-btn    { background: #fff7ed; color: #ea580c; border-color: #fed7aa; }
.pause-btn:hover { background: #fed7aa; }

.complete-btn { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
.complete-btn:hover { background: #bbf7d0; }

.delete-btn   { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.delete-btn:hover { background: #fecaca; }

/* ── Paginación ── */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
.pag-info { font-size: .8rem; color: var(--text-muted); }
</style>
