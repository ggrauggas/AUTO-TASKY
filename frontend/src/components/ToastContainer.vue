<template>
  <div class="toast-container">
    <div v-for="t in ui.toasts" :key="t.id" :class="`toast toast-${t.type}`">
      <div class="toast-stripe"></div>
      <div class="toast-content">{{ t.message }}</div>
    </div>
  </div>
</template>

<script setup>
import { useUIStore } from '@/stores/ui'
const ui = useUIStore()
</script>
