<template>
  <div v-if="!auth.isAuthenticated" class="layout">
    <router-view />
  </div>
  <div v-else class="layout">
    <aside class="sidebar">
      <div class="sidebar-logo">AUTO-TASKY</div>
      <nav>
        <router-link to="/">
          <NavIcon name="home" /> Inicio
        </router-link>
        <router-link to="/my-tasks">
          <NavIcon name="tasks" /> Mis Tareas
        </router-link>
        <router-link v-if="auth.isJefe" to="/tasks">
          <NavIcon name="manage" /> Gestión Tareas
        </router-link>
        <router-link to="/machinery">
          <NavIcon name="machine" /> Maquinaria
        </router-link>
        <router-link to="/inventory">
          <NavIcon name="inventory" /> Inventario
        </router-link>
        <router-link to="/logs">
          <NavIcon name="logs" /> Historial
        </router-link>
        <router-link v-if="auth.isAdmin" to="/admin">
          <NavIcon name="admin" /> Administración
        </router-link>
      </nav>
      <div class="sidebar-user">
        <div class="sidebar-user-info">
          <div class="sidebar-avatar">{{ auth.user?.username?.[0]?.toUpperCase() }}</div>
          <div>
            <strong>{{ auth.user?.username }}</strong>
            <span>{{ roleLabel }}</span>
          </div>
        </div>
        <button class="btn-logout" @click="doLogout">Cerrar sesión</button>
      </div>
    </aside>
    <div class="main">
      <router-view />
    </div>
  </div>
  <ToastContainer />
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ToastContainer from '@/components/ToastContainer.vue'
import NavIcon from '@/components/NavIcon.vue'

const auth   = useAuthStore()
const router = useRouter()

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
