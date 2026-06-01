import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  { path: '/',           component: () => import('@/views/DashboardView.vue') },
  { path: '/my-tasks',   component: () => import('@/views/MyTasksView.vue') },
  { path: '/tasks',      component: () => import('@/views/TasksView.vue'),     meta: { roles: ['jefe_zona','admin'] } },
  { path: '/machinery',  component: () => import('@/views/MachineryView.vue') },
  { path: '/inventory',  component: () => import('@/views/InventoryView.vue') },
  { path: '/logs',       component: () => import('@/views/LogsView.vue') },
  { path: '/admin',      component: () => import('@/views/AdminView.vue'),     meta: { roles: ['admin'] } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) return '/login'
  if (to.meta.roles && !to.meta.roles.includes(auth.user?.role)) return '/'
  if (to.path === '/login' && auth.isAuthenticated) return '/'
})

export default router
