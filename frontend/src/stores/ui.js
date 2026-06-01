import { defineStore } from 'pinia'

let _id = 0

export const useUIStore = defineStore('ui', {
  state: () => ({ toasts: [] }),
  actions: {
    toast(message, type = 'info', duration = 3500) {
      const id = ++_id
      this.toasts.push({ id, message, type })
      setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id) }, duration)
    },
    success(msg) { this.toast(msg, 'success') },
    error(msg)   { this.toast(msg, 'error', 5000) },
    warn(msg)    { this.toast(msg, 'warning') },
  },
})
