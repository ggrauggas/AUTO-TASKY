import { defineStore } from 'pinia'
import { auth as authApi } from '@/api/index'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user:  JSON.parse(localStorage.getItem('user') || 'null'),
  }),
  getters: {
    isAuthenticated: s => !!s.token,
    isAdmin:         s => s.user?.role === 'admin',
    isJefe:          s => ['jefe_zona','admin'].includes(s.user?.role),
    isPeon:          s => s.user?.role === 'peon_almacen',
  },
  actions: {
    async login(username, pin) {
      const { data } = await authApi.login({ username, pin })
      this.token = data.token
      this.user  = data.user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user',  JSON.stringify(data.user))
    },
    async logout() {
      try { await authApi.logout() } catch {}
      this.token = null
      this.user  = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
  },
})
