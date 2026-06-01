<template>
  <span :class="`badge badge-${status}`">
    <span class="badge-dot"></span>
    {{ label }}
  </span>
</template>

<script setup>
const props = defineProps({ status: String })
const LABELS = {
  sin_asignar:  'Sin asignar',
  asignada:     'Asignada',
  en_proceso:   'En proceso',
  pausada:      'Pausada',
  completada:   'Completada',
  idle:         'Inactiva',
  processing:   'Procesando',
  waiting_input:'Esperando material',
  output_ready: 'Output listo',
}
const label = LABELS[props.status] || props.status
</script>
