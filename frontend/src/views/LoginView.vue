<template>
  <div class="login-bg">
    <div class="login-split">
      <!-- Panel izquierdo - marca -->
      <div class="login-brand">
        <div class="login-brand-logo">AT</div>
        <h1 class="login-brand-title">AUTO-TASKY</h1>
        <p class="login-brand-sub">Sistema de gestión de tareas industriales</p>
        <div class="login-brand-features">
          <div class="login-feature">Control de tareas en tiempo real</div>
          <div class="login-feature">Gestión de maquinaria y materiales</div>
          <div class="login-feature">Registro completo de actividad</div>
        </div>
      </div>
      <!-- Panel derecho - formulario -->
      <div class="login-form-panel">
        <div class="login-form-box">
          <h2 class="login-form-title">Iniciar sesión</h2>
          <p class="login-form-sub">Introduce tus credenciales de acceso</p>

          <div class="form-group" style="margin-top:24px">
            <label>Nombre de usuario</label>
            <input v-model="username" placeholder="Usuario" @keyup.enter="doLogin" style="font-size:.95rem" />
          </div>

          <div style="margin-bottom:20px">
            <label style="font-size:.8rem;font-weight:600;color:var(--text-sub);display:block;margin-bottom:10px">PIN de acceso (4 dígitos)</label>
            <div class="pin-display">
              <div v-for="i in 4" :key="i" :class="['pin-dot', pin.length >= i ? 'filled' : '']"></div>
            </div>
            <div class="pin-keyboard">
              <button v-for="k in ['1','2','3','4','5','6','7','8','9','←','0','OK']"
                :key="k" class="pin-key" @click="pressKey(k)">{{ k }}</button>
            </div>
          </div>

          <div v-if="error" class="login-error">{{ error }}</div>

          <button class="btn btn-primary btn-lg w-full" :disabled="loading || !username.trim() || pin.length < 4" @click="doLogin">
            <span v-if="loading" class="spinner"></span>
            <span v-else>Acceder al sistema</span>
          </button>

          <div class="login-hint">
            Credenciales de prueba: admin / 0000
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth     = useAuthStore()
const router   = useRouter()
const username = ref('')
const pin      = ref('')
const loading  = ref(false)
const error    = ref('')

function pressKey(k) {
  if (k === '←') { pin.value = pin.value.slice(0,-1); return }
  if (k === 'OK') { doLogin(); return }
  if (pin.value.length < 4) pin.value += k
}

async function doLogin() {
  if (!username.value.trim() || pin.value.length !== 4) return
  loading.value = true; error.value = ''
  try {
    await auth.login(username.value.trim(), pin.value)
    router.push('/')
  } catch {
    error.value = 'Usuario o PIN incorrecto. Comprueba tus credenciales.'
    pin.value = ''
  } finally { loading.value = false }
}
</script>

<style scoped>
.login-bg {
  min-height: 100vh;
  background: var(--bg);
  display: flex; align-items: stretch;
}
.login-split {
  display: flex; width: 100%; min-height: 100vh;
}
/* Panel izquierdo */
.login-brand {
  width: 420px; flex-shrink: 0;
  background: var(--primary);
  padding: 60px 48px;
  display: flex; flex-direction: column; justify-content: center;
}
.login-brand-logo {
  width: 56px; height: 56px;
  background: var(--t700); color: #fff;
  font-size: 1.4rem; font-weight: 900; letter-spacing: 1px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 24px;
}
.login-brand-title {
  font-size: 1.8rem; font-weight: 800; color: #fff;
  letter-spacing: 1.5px; margin-bottom: 10px;
}
.login-brand-sub {
  font-size: .9rem; color: rgba(255,255,255,.5);
  margin-bottom: 40px; line-height: 1.6;
}
.login-brand-features { display: flex; flex-direction: column; gap: 12px; }
.login-feature {
  font-size: .85rem; color: rgba(255,255,255,.65); font-weight: 500;
  padding-left: 16px; position: relative;
}
.login-feature::before {
  content: ''; position: absolute; left: 0; top: 7px;
  width: 6px; height: 6px; background: var(--t300); border-radius: 50%;
}
/* Panel derecho */
.login-form-panel {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 40px 32px;
}
.login-form-box {
  width: 100%; max-width: 380px;
}
.login-form-title {
  font-size: 1.4rem; font-weight: 800; color: var(--text);
  margin-bottom: 4px;
}
.login-form-sub {
  font-size: .85rem; color: var(--text-muted); margin-bottom: 0;
}
.login-error {
  background: var(--danger-soft);
  border-left: 3px solid var(--danger);
  color: var(--danger);
  padding: 10px 14px; font-size: .85rem; font-weight: 500;
  margin-bottom: 16px;
}
.login-hint {
  margin-top: 16px; text-align: center;
  font-size: .76rem; color: var(--text-muted);
}
@media (max-width: 768px) {
  .login-brand { display: none; }
}
</style>
