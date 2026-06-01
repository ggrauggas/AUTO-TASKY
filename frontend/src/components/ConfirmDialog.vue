<template>
  <div class="modal-backdrop" @click.self="$emit('cancel')">
    <div class="modal">
      <div class="modal-header" :style="`background:${variant==='danger'?'var(--danger)':'var(--primary)'}`">
        <div class="modal-title">{{ title }}</div>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-sub);font-size:.92rem;line-height:1.5">{{ message }}</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" @click="$emit('cancel')">Cancelar</button>
        <button :class="`btn btn-${variant} btn-sm`" @click="$emit('confirm')">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title:       { type: String, default: 'Confirmar acción' },
  message:     { type: String, default: '¿Estás seguro?' },
  confirmText: { type: String, default: 'Confirmar' },
  variant:     { type: String, default: 'danger' },
})
defineEmits(['confirm', 'cancel'])
</script>
