import { defineStore } from 'pinia'
import { tasks as tasksApi } from '@/api/index'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    items:   [],
    total:   0,
    loading: false,
    filters: { status: '', type: '', assigned_user_id: '', page: 1, limit: 20 },
  }),
  actions: {
    async fetch(params) {
      this.loading = true
      try {
        const { data } = await tasksApi.list({ ...this.filters, ...params })
        this.items = data.data
        this.total = data.total
      } finally { this.loading = false }
    },
    setFilter(key, val) { this.filters[key] = val },
  },
})
