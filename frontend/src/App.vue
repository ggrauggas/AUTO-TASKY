<template>
  <div v-if="!auth.isAuthenticated" class="layout">
    <router-view />
  </div>
  <div v-else class="layout">
    <div :class="['sidebar-overlay', sidebarOpen ? 'open' : '']" @click="sidebarOpen = false"></div>

    <aside :class="['sidebar', sidebarOpen ? 'sidebar-open' : '', sidebarCollapsed ? 'sidebar-mini' : '']">
      <div class="sidebar-logo">
        <img :src="logoUrl" class="sidebar-logo-img" alt="AUTO-TASKY" />
        <button class="sidebar-toggle-btn" @click="toggleSidebar"
          :title="sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path v-if="!sidebarCollapsed" d="M9 2L4 7.5 9 13"/>
            <path v-else d="M6 2l5 5.5L6 13"/>
          </svg>
        </button>
      </div>

      <nav>
        <router-link to="/" data-label="Inicio">
          <NavIcon name="home" /><span class="nav-label">Inicio</span>
        </router-link>
        <router-link to="/my-tasks" data-label="Mis Tareas">
          <NavIcon name="tasks" /><span class="nav-label">Mis Tareas</span>
        </router-link>
        <router-link v-if="auth.isJefe" to="/tasks" data-label="Gestión Tareas">
          <NavIcon name="manage" /><span class="nav-label">Gestión Tareas</span>
        </router-link>
        <router-link to="/machinery" data-label="Maquinaria">
          <NavIcon name="machine" /><span class="nav-label">Maquinaria</span>
        </router-link>
        <router-link to="/inventory" data-label="Inventario">
          <NavIcon name="inventory" /><span class="nav-label">Inventario</span>
        </router-link>
        <router-link to="/logs" data-label="Historial">
          <NavIcon name="logs" /><span class="nav-label">Historial</span>
        </router-link>
        <router-link v-if="auth.isAdmin" to="/admin" data-label="Administración">
          <NavIcon name="admin" /><span class="nav-label">Administración</span>
        </router-link>
      </nav>

      <div class="sidebar-user">
        <div class="sidebar-user-info">
          <div class="sidebar-avatar" :title="auth.user?.username">
            {{ auth.user?.username?.[0]?.toUpperCase() }}
          </div>
          <div class="sidebar-user-text">
            <strong>{{ auth.user?.username }}</strong>
            <span>{{ roleLabel }}</span>
          </div>
        </div>
        <button class="btn-logout" @click="doLogout">Cerrar sesión</button>
      </div>
    </aside>

    <div class="main">
      <div class="mobile-header">
        <button class="hamburger-btn" @click="sidebarOpen = true" aria-label="Abrir menú">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect y="2"  width="20" height="2.5" rx="1"/>
            <rect y="9"  width="20" height="2.5" rx="1"/>
            <rect y="16" width="20" height="2.5" rx="1"/>
          </svg>
        </button>
        <img :src="logoUrl" class="mobile-header-logo" alt="AUTO-TASKY" />
      </div>
      <router-view />
    </div>
  </div>
  <ToastContainer />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ToastContainer from '@/components/ToastContainer.vue'
import NavIcon from '@/components/NavIcon.vue'
import logoUrl from '@/assets/LOGO.png'

const auth   = useAuthStore()
const router = useRouter()
const route  = useRoute()

const sidebarOpen      = ref(false)
const sidebarCollapsed = ref(localStorage.getItem('nav-collapsed') === 'true')

watch(() => route.path, () => { sidebarOpen.value = false })

function toggleSidebar() {
  if (window.innerWidth <= 960) {
    sidebarOpen.value = false
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('nav-collapsed', String(sidebarCollapsed.value))
  }
}

const roleLabel = computed(() => ({
  admin:        'Administrador',
  jefe_zona:    'Jefe de Zona',
  peon_almacen: 'Peón de Almacén',
}[auth.user?.role] || ''))

async function doLogout() {
  await auth.logout()
  router.push('/login')
}
</script>
