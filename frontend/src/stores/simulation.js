import { defineStore } from 'pinia'
import { simulation as simApi } from '@/api/index'

export const useSimulationStore = defineStore('simulation', {
  state: () => ({ config: null }),
  getters: { active: s => !!s.config?.active },
  actions: {
    async fetch()          { const { data } = await simApi.status(); this.config = data },
    async toggle()         { const { data } = await simApi.toggle(); this.config = data },
    async saveConfig(cfg)  { const { data } = await simApi.config(cfg); this.config = data },
  },
})
