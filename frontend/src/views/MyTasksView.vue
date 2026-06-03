<template>
  <div>
    <div class="topbar"><h1>Mis Tareas</h1></div>
    <div class="page">
      <div class="flex-between mb-4">
        <select v-model="filterStatus" style="width:200px">
          <option value="">Activas</option>
          <option value="sin_asignar">Sin asignar</option>
          <option value="asignada">Asignada</option>
          <option value="en_proceso">En proceso</option>
          <option value="pausada">Pausada</option>
          <option value="completada">Completadas</option>
        </select>
        <span class="text-muted text-sm">Actualización automática cada 5s</span>
      </div>

      <div v-if="loading && !tasks.length" class="empty"><span class="spinner spinner-teal"></span></div>
      <div v-else-if="!tasks.length" class="empty">
        <div class="empty-title">No hay tareas disponibles</div>
        <div class="empty-sub">Las tareas sin asignar y tus tareas activas aparecerán aquí</div>
      </div>

      <div v-else style="display:flex;flex-direction:column;gap:10px">
        <div v-for="t in tasks" :key="t.id" :class="['task-card', t.status==='pausada'?'paused':'']">
          <div class="task-card-header">
            <div>
              <div class="task-card-type">{{ typeLabel(t.type) }}</div>
              <div class="task-card-meta">Tarea #{{ t.id }}{{ t.is_simulation ? ' · Simulación' : '' }}</div>
            </div>
            <StatusBadge :status="t.status" />
          </div>
          <div class="task-card-body">
            <div>
              <span class="task-field-label">Material</span>
              <span class="task-field-value">{{ t.material_name }}</span>
              <span class="task-field-label" style="margin-top:2px">{{ t.quantity }} {{ t.material_unit }}</span>
            </div>
            <div>
              <span class="task-field-label">Origen</span>
              <span class="task-field-value">{{ t.origin_name }}</span>
            </div>
            <div>
              <span class="task-field-label">Destino</span>
              <span class="task-field-value">{{ t.destination_name }}</span>
            </div>
          </div>
          <div v-if="t.pause_reason" style="font-size:.82rem;font-weight:600;margin-bottom:10px;padding:6px 10px;background:rgba(0,0,0,.08)">
            Motivo de pausa: {{ t.pause_reason }}
          </div>
          <div class="task-card-actions">
            <button v-if="t.status==='sin_asignar'" class="btn btn-primary btn-sm" @click="take(t)">Tomar tarea</button>
            <button v-if="t.status==='asignada' && t.assigned_user_id===auth.user.id" class="btn btn-primary btn-sm" @click="start(t)">Iniciar trabajo</button>
            <button v-if="t.status==='en_proceso' && t.assigned_user_id===auth.user.id" class="btn btn-warning btn-sm" @click="openPause(t)">Pausar</button>
            <button v-if="t.status==='pausada' && t.assigned_user_id===auth.user.id" class="btn btn-primary btn-sm" @click="resume(t)">Reanudar</button>
            <button v-if="['en_proceso','pausada'].includes(t.status) && t.assigned_user_id===auth.user.id"
              class="btn btn-primary btn-sm" @click="complete(t)">Marcar completada</button>
          </div>
        </div>
      </div>
    </div>

    <PauseDialog v-if="pauseTask" @confirm="doPause" @cancel="pauseTask=null" />
  </div>

</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { tasks as tasksApi } from '@/api/index'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import StatusBadge from '@/components/StatusBadge.vue'
import PauseDialog from '@/components/PauseDialog.vue'

const auth  = useAuthStore()
const ui    = useUIStore()
const route = useRoute()
const tasks = ref([])
const loading = ref(false)
const filterStatus = ref(route.query.status || '')
const pauseTask = ref(null)

const TYPE_LABELS = {
  enviar_materia_prima: 'Enviar materia prima',
  ubicar_elemento:      'Ubicar elemento',
  eliminar_residuo:     'Eliminar residuo',
}
const typeLabel = t => TYPE_LABELS[t] || t

async function load() {
  loading.value = true
  try {
    const f = filterStatus.value

    if (f === 'completada') {
      // Solo las completadas propias
      const { data } = await tasksApi.list({ assigned_user_id: auth.user.id, status: 'completada', limit: 100 })
      tasks.value = data.data
      return
    }

    if (f && f !== 'sin_asignar') {
      // Filtro específico distinto de sin_asignar — solo propias con ese estado
      const { data } = await tasksApi.list({ assigned_user_id: auth.user.id, status: f, limit: 100 })
      tasks.value = data.data
      return
    }

    // Por defecto: mis tareas activas + todas las sin asignar
    const params = { limit: 100 }
    if (f === 'sin_asignar') params.status = 'sin_asignar'

    const [mine, unassigned] = await Promise.all([
      f !== 'sin_asignar'
        ? tasksApi.list({ assigned_user_id: auth.user.id, limit: 100 })
        : Promise.resolve({ data: { data: [] } }),
      tasksApi.list({ status: 'sin_asignar', limit: 100 }),
    ])

    // Activas: excluir completadas del stream por defecto
    const mineFiltered = mine.data.data.filter(t => t.status !== 'completada')
    const combined = [...mineFiltered, ...unassigned.data.data]
    const seen = new Set()
    tasks.value = combined.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
  } finally { loading.value = false }
}

async function take(t)    { try { await tasksApi.take(t.id);         ui.success('Tarea tomada.');     load() } catch(e) { ui.error(e.response?.data?.message || 'Error') } }
async function start(t)   { try { await tasksApi.start(t.id);        ui.success('Tarea iniciada.');   load() } catch(e) { ui.error(e.response?.data?.message || 'Error') } }
async function resume(t)  { try { await tasksApi.resume(t.id);       ui.success('Tarea reanudada.');  load() } catch(e) { ui.error(e.response?.data?.message || 'Error') } }
async function complete(t){ try { await tasksApi.complete(t.id);     ui.success('Tarea completada.'); load() } catch(e) { ui.error(e.response?.data?.message || 'Error') } }
function openPause(t)     { pauseTask.value = t }
async function doPause(reason) {
  try { await tasksApi.pause(pauseTask.value.id, reason); ui.success('Tarea pausada.'); pauseTask.value = null; load() }
  catch(e) { ui.error(e.response?.data?.message || 'Error') }
}

watch(filterStatus, load)
let interval
onMounted(() => { load(); interval = setInterval(load, 5000) })
onUnmounted(() => clearInterval(interval))
</script>
