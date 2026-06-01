<template>
  <div class="page">
    <div class="topbar">
      <h1>Panel de Maquinaria</h1>
      <button v-if="auth.isJefe" class="btn btn-primary btn-sm" @click="showForm=true">+ Nueva tarea</button>
    </div>
    <div class="page" style="padding-top:20px">
      <div class="section-title">Máquinas</div>
      <div class="table-wrap mb-4">
        <table>
          <thead><tr><th>Máquina</th><th>Tipo</th><th>Estado</th><th>Input</th><th>Output</th></tr></thead>
          <tbody>
            <tr v-if="!machines.length"><td colspan="5" class="empty">Cargando...</td></tr>
            <tr v-for="m in machines" :key="m.id">
              <td><strong>{{ m.name }}</strong></td>
              <td class="text-muted text-sm">{{ m.type }}</td>
              <td><StatusBadge :status="m.status" /></td>
              <td>{{ m.input_quantity }} {{ m.input_material_unit || '' }} <span class="text-muted text-sm">{{ m.input_material_name }}</span></td>
              <td>{{ m.output_quantity }} {{ m.output_material_unit || '' }} <span class="text-muted text-sm">{{ m.output_material_name }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="section-title">Tareas activas</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Tipo</th><th>Estado</th><th>Material</th><th>Cant.</th><th>Origen</th><th>Destino</th><th>Asignado</th><th>Acciones</th></tr></thead>
          <tbody>
            <tr v-if="!activeTasks.length"><td colspan="9" class="empty">Sin tareas activas.</td></tr>
            <tr v-for="t in activeTasks" :key="t.id">
              <td>{{ t.id }}</td>
              <td class="text-sm">{{ typeLabel(t.type) }}</td>
              <td><StatusBadge :status="t.status" /></td>
              <td>{{ t.material_name }}</td>
              <td>{{ t.quantity }} {{ t.material_unit }}</td>
              <td class="text-sm">{{ t.origin_name }}</td>
              <td class="text-sm">{{ t.destination_name }}</td>
              <td>{{ t.assigned_username || '—' }}</td>
              <td>
                <button v-if="auth.isJefe && t.status!=='completada'" class="btn btn-ghost btn-sm" @click="editTask=t;showForm=true">Editar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <TaskForm v-if="showForm" :task="editTask" @close="showForm=false;editTask=null" @saved="showForm=false;editTask=null;load()" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { machines as machinesApi, tasks as tasksApi } from '@/api/index'
import { useAuthStore } from '@/stores/auth'
import StatusBadge from '@/components/StatusBadge.vue'
import TaskForm from '@/components/TaskForm.vue'

const auth      = useAuthStore()
const machines  = ref([])
const activeTasks = ref([])
const showForm  = ref(false)
const editTask  = ref(null)

const TYPE_LABELS = { enviar_materia_prima:'Enviar materia prima', ubicar_elemento:'Ubicar elemento', eliminar_residuo:'Eliminar residuo' }
const typeLabel = t => TYPE_LABELS[t] || t

async function load() {
  const [m, t] = await Promise.all([
    machinesApi.list(),
    tasksApi.list({ limit: 100 }),
  ])
  machines.value  = m.data
  activeTasks.value = t.data.data.filter(x => x.status !== 'completada')
}

let interval
onMounted(() => { load(); interval=setInterval(load, 5000) })
onUnmounted(() => clearInterval(interval))
</script>
