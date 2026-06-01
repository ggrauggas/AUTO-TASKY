<template>
  <div class="page">
    <div class="topbar"><h1>Registro histórico</h1></div>
    <div class="page" style="padding-top:20px">
      <div class="flex gap-2 mb-4" style="flex-wrap:wrap">
        <select v-model="filters.type" style="width:190px">
          <option value="">Tipo</option>
          <option value="enviar_materia_prima">Enviar materia prima</option>
          <option value="ubicar_elemento">Ubicar elemento</option>
          <option value="eliminar_residuo">Eliminar residuo</option>
        </select>
        <input v-model="filters.from" type="date" style="width:150px" />
        <input v-model="filters.to"   type="date" style="width:150px" />
        <button class="btn btn-ghost btn-sm" @click="resetFilters">Limpiar</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Tipo</th><th>Material</th><th>Cant.</th><th>Origen</th><th>Destino</th>
            <th>Realizado por</th><th>Completada</th><th>Duración</th><th>Motivo pausa</th>
          </tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="10" style="text-align:center;padding:24px"><span class="spinner"></span></td></tr>
            <tr v-else-if="!logs.length"><td colspan="10" class="empty">Sin registros.</td></tr>
            <tr v-for="l in logs" :key="l.id">
              <td>{{ l.id }}</td>
              <td class="text-sm">{{ typeLabel(l.type) }}</td>
              <td>{{ l.material_name }}</td>
              <td>{{ l.quantity }} {{ l.material_unit }}</td>
              <td class="text-sm">{{ l.origin_name }}</td>
              <td class="text-sm">{{ l.destination_name }}</td>
              <td>{{ l.assigned_username || '—' }}</td>
              <td class="text-sm text-muted">{{ fmtDate(l.completed_at) }}</td>
              <td class="text-sm">{{ fmtDuration(l.duration_sec) }}</td>
              <td class="text-sm" style="color:var(--warning)">{{ l.pause_reason || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex-between mt-4">
        <span class="text-muted text-sm">{{ total }} registros</span>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" :disabled="page<=1" @click="page--;load()">Anterior</button>
          <span class="text-sm" style="align-self:center">Pág. {{ page }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="page*50>=total" @click="page++;load()">Siguiente</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { logs as logsApi } from '@/api/index'

const logs    = ref([])
const total   = ref(0)
const page    = ref(1)
const loading = ref(false)
const filters = reactive({ type:'', from:'', to:'' })

const TYPE_LABELS = { enviar_materia_prima:'Enviar materia prima', ubicar_elemento:'Ubicar elemento', eliminar_residuo:'Eliminar residuo' }
const typeLabel   = t => TYPE_LABELS[t] || t
const fmtDate     = d => d ? new Date(d).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'
const fmtDuration = s => { if (!s) return '—'; const m=Math.floor(s/60),sec=s%60; return m>0?`${m}m ${sec}s`:`${sec}s` }

async function load() {
  loading.value = true
  try {
    const params = { page: page.value, limit: 50 }
    if (filters.type) params.type = filters.type
    if (filters.from) params.from = filters.from
    if (filters.to)   params.to   = filters.to
    const { data } = await logsApi.list(params)
    logs.value = data.data; total.value = data.total
  } finally { loading.value = false }
}

function resetFilters() { filters.type=''; filters.from=''; filters.to=''; page.value=1; load() }
watch([()=>filters.type,()=>filters.from,()=>filters.to], () => { page.value=1; load() })
onMounted(load)
</script>
