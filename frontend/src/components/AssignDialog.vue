<template>
  <div class="modal-backdrop" @click.self="$emit('cancel')">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Asignar tarea a usuario</div>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Selecciona el usuario</label>
          <select v-model="userId">
            <option :value="null">-- Elige un usuario --</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }} — {{ u.role }}</option>
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" @click="$emit('cancel')">Cancelar</button>
        <button class="btn btn-primary btn-sm" :disabled="!userId" @click="$emit('confirm', userId)">Asignar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
defineProps({ users: Array })
defineEmits(['confirm', 'cancel'])
const userId = ref(null)
</script>
