<template>
  <div class="page">
    <div class="topbar"><h1>Inventario</h1></div>
    <div class="page" style="padding-top:20px">
      <div class="flex gap-2 mb-4">
        <input v-model="search" placeholder="Buscar ubicación o material..." style="width:280px" />
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ubicación</th><th>Tipo</th><th>Material</th><th>Cantidad</th><th>Unidad</th><th v-if="auth.isAdmin">Ajustar</th></tr></thead>
          <tbody>
            <tr v-if="!filtered.length"><td :colspan="auth.isAdmin?6:5" class="empty">Sin datos.</td></tr>
            <tr v-for="row in filtered" :key="row.id">
              <td><strong>{{ row.location_name }}</strong></td>
              <td><span class="badge badge-sin_asignar text-sm">{{ row.location_type }}</span></td>
              <td>{{ row.material_name }}</td>
              <td>
                <template v-if="editing===row.id">
                  <input v-model.number="editQty" type="number" min="0" style="width:90px" />
                </template>
                <template v-else>{{ row.quantity }}</template>
              </td>
              <td>{{ row.material_unit }}</td>
              <td v-if="auth.isAdmin">
                <template v-if="editing===row.id">
                  <button class="btn btn-success btn-sm" @click="saveEdit(row)">OK</button>
                  <button class="btn btn-ghost btn-sm" @click="editing=null">✕</button>
                </template>
                <button v-else class="btn btn-ghost btn-sm" @click="startEdit(row)">Editar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { inventory as invApi } from '@/api/index'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const auth    = useAuthStore()
const ui      = useUIStore()
const items   = ref([])
const search  = ref('')
const editing = ref(null)
const editQty = ref(0)

const filtered = computed(() => {
  const s = search.value.toLowerCase()
  return items.value.filter(r =>
    r.location_name.toLowerCase().includes(s) ||
    r.material_name.toLowerCase().includes(s)
  )
})

async function load() {
  const { data } = await invApi.list()
  items.value = data
}

function startEdit(row) { editing.value = row.id; editQty.value = row.quantity }
async function saveEdit(row) {
  try {
    await invApi.adjust({ location_id: row.location_id, material_id: row.material_id, quantity: editQty.value })
    ui.success('Inventario ajustado.')
    editing.value = null
    load()
  } catch(e) { ui.error(e.response?.data?.message || 'Error') }
}

let interval
onMounted(() => { load(); interval=setInterval(load,5000) })
onUnmounted(() => clearInterval(interval))
</script>
