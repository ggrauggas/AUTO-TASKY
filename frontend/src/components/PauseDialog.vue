<template>
  <div class="modal-backdrop" @click.self="$emit('cancel')">
    <div class="modal">
      <div class="modal-header" style="background:var(--warn-bg)">
        <div class="modal-title" style="color:var(--warn-text)">Pausar tarea</div>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Motivo de la pausa (obligatorio)</label>
          <textarea v-model="reason" placeholder="Describe el motivo de la pausa..." rows="4" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" @click="$emit('cancel')">Cancelar</button>
        <button class="btn btn-warning btn-sm" :disabled="!reason.trim()" @click="confirm">Pausar tarea</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const emit   = defineEmits(['confirm', 'cancel'])
const reason = ref('')
function confirm() { if (reason.value.trim()) emit('confirm', reason.value.trim()) }
</script>
