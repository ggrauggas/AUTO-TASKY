<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal" style="max-width:580px">
      <div class="modal-header">
        <div class="modal-title">{{ task ? 'Editar tarea' : 'Nueva tarea' }}</div>
      </div>
      <div class="modal-body">
      <div class="form-group">
        <label>Tipo</label>
        <select v-model="form.type" :disabled="!!task">
          <option value="enviar_materia_prima">Enviar materia prima</option>
          <option value="ubicar_elemento">Ubicar elemento en almacén</option>
          <option value="eliminar_residuo">Eliminar residuo</option>
        </select>
      </div>
      <div class="form-group">
        <label>Material</label>
        <select v-model="form.material_id">
          <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }} ({{ m.unit }})</option>
        </select>
      </div>
      <div class="form-group">
        <label>Cantidad</label>
        <input type="number" v-model.number="form.quantity" min="0.01" step="0.01" />
      </div>
      <div class="form-group">
        <label>Origen</label>
        <select v-model="form.origin_location_id">
          <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }} ({{ l.type }})</option>
        </select>
      </div>
      <div class="form-group">
        <label>Destino</label>
        <select v-model="form.destination_location_id">
          <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }} ({{ l.type }})</option>
        </select>
      </div>
      <div class="form-group">
        <label>Asignar a usuario (opcional)</label>
        <select v-model="form.assigned_user_id">
          <option :value="null">Sin asignar</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }} ({{ u.role }})</option>
        </select>
      </div>
      <div v-if="error" style="background:var(--danger-soft);border-left:3px solid var(--danger);color:var(--danger);padding:10px 14px;font-size:.85rem;margin-bottom:12px">{{ error }}</div>
      </div><!-- end modal-body -->
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" @click="$emit('close')">Cancelar</button>
        <button class="btn btn-primary btn-sm" :disabled="saving" @click="submit">
          <span v-if="saving" class="spinner"></span>
          {{ task ? 'Guardar cambios' : 'Crear tarea' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { materials as matApi, locations as locApi, users as usersApi, tasks as tasksApi } from '@/api/index'
import { useUIStore } from '@/stores/ui'

const props = defineProps({ task: { type: Object, default: null } })
const emit  = defineEmits(['close', 'saved'])
const ui    = useUIStore()

const materials = ref([])
const locations = ref([])
const users     = ref([])
const saving    = ref(false)
const error     = ref('')

const form = reactive({
  type:                   props.task?.type                   || 'enviar_materia_prima',
  material_id:            props.task?.material_id            || null,
  quantity:               props.task?.quantity               || '',
  origin_location_id:     props.task?.origin_location_id     || null,
  destination_location_id:props.task?.destination_location_id|| null,
  assigned_user_id:       props.task?.assigned_user_id       || null,
})

onMounted(async () => {
  const [m, l, u] = await Promise.all([matApi.list(), locApi.list(), usersApi.list()])
  materials.value = m.data
  locations.value = l.data.filter(x => x.active)
  users.value     = u.data.filter(x => x.active)
})

async function submit() {
  error.value = ''
  if (!form.material_id || !form.quantity || !form.origin_location_id || !form.destination_location_id) {
    error.value = 'Completa todos los campos obligatorios.'
    return
  }
  saving.value = true
  try {
    if (props.task) {
      await tasksApi.update(props.task.id, form)
      ui.success('Tarea actualizada.')
    } else {
      await tasksApi.create(form)
      ui.success('Tarea creada.')
    }
    emit('saved')
  } catch (e) {
    error.value = e.response?.data?.message || 'Error al guardar.'
  } finally { saving.value = false }
}
</script>
