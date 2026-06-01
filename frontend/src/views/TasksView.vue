<template>
  <div>
    <div class="topbar">
      <h1>Gestión de Tareas</h1>
      <button class="btn btn-primary btn-sm" @click="showForm=true">+ Nueva tarea</button>
    </div>
    <div class="page">

      <!-- Filtros -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
        <select v-model="filters.status" style="width:170px">
          <option value="">Todos los estados</option>
          <option value="sin_asignar">Sin asignar</option>
          <option value="asignada">Asignada</option>
          <option value="en_proceso">En proceso</option>
          <option value="pausada">Pausada</option>
          <option value="completada">Completada</option>
        </select>
        <select v-model="filters.type" style="width:200px">
          <option value="">Todos los tipos</option>
          <option value="enviar_materia_prima">Enviar materia prima</option>
          <option value="ubicar_elemento">Ubicar elemento</option>
          <option value="eliminar_residuo">Eliminar residuo</option>
        </select>
        <button class="btn btn-ghost btn-sm" @click="resetFilters">Limpiar filtros</button>
        <span style="margin-left:auto;font-size:.8rem;color:var(--text-muted);font-weight:500">
          {{ total }} tareas encontradas
        </span>
      </div>

      <!-- Tabla -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:50px">#</th>
              <th style="width:160px">Tipo de tarea</th>
              <th style="width:130px">Estado</th>
              <th>Material</th>
              <th style="width:80px">Cantidad</th>
              <th>Origen</th>
              <th>Destino</th>
              <th style="width:110px">Asignado a</th>
              <th style="width:95px">Creado</th>
              <th style="width:180px">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="10" style="text-align:center;padding:32px">
                <span class="spinner spinner-teal"></span>
              </td>
            </tr>
            <tr v-else-if="!tasks.length">
              <td colspan="10">
                <div class="empty"><div class="empty-title">Sin resultados</div><div class="empty-sub">Prueba cambiando los filtros</div></div>
              </td>
            </tr>
            <tr v-for="t in tasks" :key="t.id" :class="t.status==='pausada' ? 'row-warn' : t.status==='completada' ? 'row-done' : ''">
              <td style="font-weight:700;color:var(--text-muted);font-size:.8rem">#{{ t.id }}</td>
              <td>
                <span class="type-pill" :class="`type-${t.type}`">{{ typeShort(t.type) }}</span>
              </td>
              <td><StatusBadge :status="t.status" /></td>
              <td>
                <div style="font-weight:600;font-size:.88rem">{{ t.material_name }}</div>
              </td>
              <td style="font-weight:700;color:var(--primary)">{{ t.quantity }} <span style="font-weight:400;color:var(--text-muted);font-size:.78rem">{{ t.material_unit }}</span></td>
              <td>
                <div style="font-size:.85rem;font-weight:500">{{ t.origin_name }}</div>
              </td>
              <td>
                <div style="font-size:.85rem;font-weight:500">{{ t.destination_name }}</div>
              </td>
              <td>
                <span v-if="t.assigned_username" style="font-weight:600;font-size:.85rem;color:var(--primary)">{{ t.assigned_username }}</span>
                <span v-else style="font-size:.8rem;color:var(--text-muted)">Sin asignar</span>
              </td>
              <td style="font-size:.78rem;color:var(--text-muted)">{{ fmtDate(t.created_at) }}</td>
              <td>
                <div style="display:flex;gap:5px;flex-wrap:wrap">
                  <!-- Editar -->
                  <button v-if="t.status!=='completada'" class="btn btn-ghost btn-sm" title="Editar"
                    @click="editTask=t;showForm=true">Editar</button>
                  <!-- Acciones de estado -->
                  <button v-if="t.status==='sin_asignar'" class="btn btn-sm" style="background:var(--t100);color:var(--t700);border:1px solid var(--t200)"
                    @click="changeStatus(t,'take')">Tomar</button>
                  <button v-if="t.status==='sin_asignar'||t.status==='asignada'" class="btn btn-sm" style="background:var(--t100);color:var(--t700);border:1px solid var(--t200)"
                    @click="assignTask=t;loadUsers()">Asignar</button>
                  <button v-if="t.status==='asignada'" class="btn btn-sm" style="background:var(--primary);color:#fff;border:none"
                    @click="changeStatus(t,'start')">Iniciar</button>
                  <button v-if="t.status==='en_proceso'" class="btn btn-warning btn-sm"
                    @click="pauseTask=t">Pausar</button>
                  <button v-if="t.status==='pausada'" class="btn btn-sm" style="background:var(--primary);color:#fff;border:none"
                    @click="changeStatus(t,'resume')">Reanudar</button>
                  <button v-if="t.status==='en_proceso'||t.status==='pausada'" class="btn btn-success btn-sm"
                    @click="changeStatus(t,'complete')">Completar</button>
                  <!-- Eliminar -->
                  <button v-if="auth.isAdmin" class="btn btn-danger btn-sm"
                    @click="deleteTask=t">Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
        <span style="font-size:.8rem;color:var(--text-muted)">Página {{ page }} — mostrando {{ tasks.length }} de {{ total }}</span>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" :disabled="page<=1" @click="page--;load()">Anterior</button>
          <button class="btn btn-ghost btn-sm" :disabled="page*limit>=total" @click="page++;load()">Siguiente</button>
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
  enviar_materia_prima: 'Envío mat. prima',
  ubicar_elemento:      'Ubicar elemento',
  eliminar_residuo:     'Eliminar residuo',
}
const typeShort = t => TYPE_SHORT[t] || t
const fmtDate   = d => d ? new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'

async function load() {
  loading.value = true
  try {
    const p = { page: page.value, limit }
    if (filters.status) p.status = filters.status
    if (filters.type)   p.type   = filters.type
    const { data } = await tasksApi.list(p)
    tasks.value = data.data; total.value = data.total
  } finally { loading.value = false }
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
onMounted(()=>{ load(); interval=setInterval(load,5000) })
onUnmounted(()=>clearInterval(interval))
</script>

<style scoped>
.row-warn td  { background: var(--warn-soft) !important; }
.row-done td  { background: #f6fffe !important; color: var(--text-muted); }
.row-done td:hover { background: var(--t50) !important; }

.type-pill {
  display: inline-block; padding: 3px 9px;
  font-size: .72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .04em; white-space: nowrap;
}
.type-enviar_materia_prima { background: var(--t100); color: var(--t700); }
.type-ubicar_elemento      { background: #e0f2fe;    color: #0369a1; }
.type-eliminar_residuo     { background: #fef3c7;    color: #92400e; }
</style>
