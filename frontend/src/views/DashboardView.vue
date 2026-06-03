<template>
  <div>
    <div class="topbar">
      <h1>Panel de control</h1>
      <div v-if="auth.isAdmin" class="flex gap-3" style="align-items:center">
        <span class="text-muted" style="font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Simulación</span>
        <button :class="['toggle', simStore.active ? 'on' : '']" @click="toggleSim"></button>
        <span :style="`font-size:.82rem;font-weight:700;color:${simStore.active?'var(--primary)':'var(--text-muted)'}`">
          {{ simStore.active ? 'Activa' : 'Inactiva' }}
        </span>
      </div>
    </div>

    <div class="page">

      <div v-if="auth.isAdmin" :class="['sim-banner', simStore.active ? 'active' : 'inactive']">
        <span>Simulación automática</span>
        <span style="font-weight:400">
          {{ simStore.active
            ? '— El sistema genera y procesa tareas automáticamente'
            : '— Activar para iniciar el flujo automático del sistema' }}
        </span>
      </div>

      <!-- KPIs clicables -->
      <div class="grid-auto mb-6">
        <div class="stat-card s-dark kpi-link" @click="goTasks('sin_asignar')">
          <div class="stat-card-label">Sin asignar</div>
          <div class="stat-card-value">{{ stats.sin_asignar }}</div>
          <div class="stat-card-sub">Tareas pendientes de asignación →</div>
        </div>
        <div class="stat-card kpi-link" @click="goTasks('asignada')">
          <div class="stat-card-label">Asignadas</div>
          <div class="stat-card-value">{{ stats.asignada }}</div>
          <div class="stat-card-sub">Asignadas, pendientes de inicio →</div>
        </div>
        <div class="stat-card s-light kpi-link" @click="goTasks('en_proceso')">
          <div class="stat-card-label">En proceso</div>
          <div class="stat-card-value">{{ stats.en_proceso }}</div>
          <div class="stat-card-sub">Trabajos en curso ahora →</div>
        </div>
        <div class="stat-card kpi-link" @click="goTasks('pausada')">
          <div class="stat-card-label">Pausadas</div>
          <div class="stat-card-value">{{ stats.pausada }}</div>
          <div class="stat-card-sub">Requieren atención →</div>
        </div>
        <div class="stat-card s-dark kpi-link" @click="goLogs()">
          <div class="stat-card-label">Completadas</div>
          <div class="stat-card-value">{{ stats.completadas }}</div>
          <div class="stat-card-sub">Ver historial completo →</div>
        </div>
      </div>

      <!-- Layout principal -->
      <div class="dashboard-grid">

        <!-- Feed actividad -->
        <div>
          <div class="activity-feed">
            <div class="activity-feed-header">
              Actividad en tiempo real
              <span style="float:right;font-weight:400;text-transform:none;letter-spacing:0;font-size:.72rem">Actualización cada 5 s</span>
            </div>
            <div style="max-height:520px;overflow-y:auto">
              <div v-if="activityError" style="padding:20px 16px;border-left:3px solid var(--danger);background:var(--danger-soft);color:var(--danger);font-size:.85rem;font-weight:500">
                {{ activityError }}
              </div>
              <div v-else-if="!events.length" class="empty">
                <div class="empty-title">Sin actividad registrada aún</div>
                <div class="empty-sub">Los eventos del sistema aparecerán aquí en tiempo real</div>
              </div>
              <div v-for="ev in events" :key="ev.id" class="activity-item">
                <div :class="['activity-line', lineClass(ev.event_type)]"></div>
                <div class="activity-body">
                  <span class="activity-msg">{{ ev.description }}</span>
                  <span class="activity-time">{{ timeAgo(ev.timestamp) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Columna derecha -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- Maquinaria -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Estado de maquinaria</span>
            </div>
            <div style="display:flex;flex-direction:column">
              <div v-for="m in machines" :key="m.id"
                style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.15)">
                <div>
                  <div style="font-size:.88rem;font-weight:600;color:#fff">{{ m.name }}</div>
                  <div v-if="m.output_quantity>0" style="font-size:.75rem;color:var(--t200);font-weight:600;margin-top:2px">
                    {{ m.output_quantity }} {{ m.output_material_unit }} disponible
                  </div>
                </div>
                <StatusBadge :status="m.status" />
              </div>
              <div v-if="!machines.length" style="padding:16px 0;font-size:.82rem;color:rgba(255,255,255,.5);text-align:center">
                Sin máquinas configuradas
              </div>
            </div>
          </div>

          <!-- KPI maquinaria -->
          <div class="dashboard-machines-kpi">
            <div class="stat-card" style="padding:14px 16px">
              <div class="stat-card-label">Procesando</div>
              <div class="stat-card-value" style="font-size:1.8rem">{{ machineStats.processing }}</div>
            </div>
            <div class="stat-card s-light" style="padding:14px 16px">
              <div class="stat-card-label">Output listo</div>
              <div class="stat-card-value" style="font-size:1.8rem">{{ machineStats.output_ready }}</div>
            </div>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { tasks as tasksApi, machines as machinesApi, activity as activityApi } from '@/api/index'
import { useAuthStore } from '@/stores/auth'
import { useSimulationStore } from '@/stores/simulation'
import StatusBadge from '@/components/StatusBadge.vue'

const auth     = useAuthStore()
const router   = useRouter()
const simStore = useSimulationStore()

function goTasks(status) {
  // Peones van a sus tareas, jefe/admin a gestión completa
  const target = auth.isJefe ? '/tasks' : '/my-tasks'
  router.push({ path: target, query: { status } })
}
function goLogs() {
  router.push('/logs')
}
const stats    = reactive({ sin_asignar:0, asignada:0, en_proceso:0, pausada:0, completadas:0 })
const machineStats = reactive({ processing:0, output_ready:0 })
const machines      = ref([])
const events        = ref([])
const activityError = ref('')

const LINE_CLASS = {
  task_completada:   'line-green',
  task_en_proceso:   'line-blue',
  task_asignada:     'line-blue',
  task_pausada:      'line-orange',
  task_sin_asignar:  'line-gray',
  simulation_toggle: 'line-purple',
  machine_complete:  'line-green',
  sim_task_created:  'line-blue',
}
const lineClass = t => LINE_CLASS[t] || 'line-gray'

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (s < 60)  return 'Hace un momento'
  const m = Math.floor(s / 60)
  if (m < 60)  return `Hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `Hace ${h} h`
  return new Date(ts).toLocaleDateString('es-ES', { day:'2-digit', month:'short' })
}

async function load() {
  const [s1,s2,s3,s4,sc] = await Promise.all([
    tasksApi.list({ status:'sin_asignar', limit:1 }),
    tasksApi.list({ status:'asignada',    limit:1 }),
    tasksApi.list({ status:'en_proceso',  limit:1 }),
    tasksApi.list({ status:'pausada',     limit:1 }),
    tasksApi.list({ status:'completada',  limit:1 }),
  ])
  stats.sin_asignar = s1.data.total
  stats.asignada    = s2.data.total
  stats.en_proceso  = s3.data.total
  stats.pausada     = s4.data.total
  stats.completadas = sc.data.total

  const [machsRes, actsRes] = await Promise.allSettled([
    machinesApi.list(),
    activityApi.list({ limit: 60 }),
  ])
  if (machsRes.status === 'fulfilled') {
    machines.value = machsRes.value.data
    machineStats.processing  = machsRes.value.data.filter(m => m.status === 'processing').length
    machineStats.output_ready= machsRes.value.data.filter(m => m.status === 'output_ready').length
  }
  if (actsRes.status === 'fulfilled') {
    events.value = actsRes.value.data
    activityError.value = ''
  } else {
    activityError.value = 'No se pudo cargar la actividad. Asegúrate de haber ejecutado npm run db:migrate.'
  }

  if (auth.isAdmin) await simStore.fetch()
}

async function toggleSim() { await simStore.toggle(); load() }

let interval
onMounted(() => { load(); interval = setInterval(load, 5000) })
onUnmounted(() => clearInterval(interval))
</script>

<style scoped>
.kpi-link {
  cursor: pointer;
  transition: filter .12s, transform .1s;
}
.kpi-link:hover  { filter: brightness(1.12); }
.kpi-link:active { transform: translateY(1px); }
</style>
