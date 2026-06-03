# Deploy AUTO-TASKY

Stack: **Netlify** (frontend) · **Railway** (backend) · **Supabase** (PostgreSQL)

---

## Índice

1. [Pre-requisitos](#1-pre-requisitos)
2. [Supabase — Base de datos](#2-supabase--base-de-datos)
3. [Railway — Backend](#3-railway--backend)
4. [Netlify — Frontend](#4-netlify--frontend)
5. [Variables de entorno — resumen](#5-variables-de-entorno--resumen)
6. [Verificar que todo funciona](#6-verificar-que-todo-funciona)
7. [Comandos útiles post-deploy](#7-comandos-útiles-post-deploy)

---

## 1. Pre-requisitos

- Cuenta en [GitHub](https://github.com) con el repositorio subido
- Node.js 20+ instalado localmente
- El proyecto tiene el código subido a la rama `main`

Si aún no tienes el repo en GitHub:

```bash
git remote add origin https://github.com/TU_USUARIO/auto-tasky.git
git branch -M main
git push -u origin main
```

---

## 2. Supabase — Base de datos

### 2.1 Crear proyecto

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Pulsa **New Project**.
3. Rellena:
   - **Name**: `auto-tasky`
   - **Database Password**: elige una contraseña fuerte y **guárdala**, la necesitarás.
   - **Region**: el más cercano (ej. `eu-central-1` para España).
4. Espera ~2 minutos hasta que el proyecto esté listo.

### 2.2 Obtener la connection string

1. En el panel de Supabase, ve a **Settings → Database**.
2. Baja hasta **Connection string → URI**.
3. Selecciona el modo **Session** (no Transaction, para compatibilidad con pg Pool).
4. Copia la URI, tendrá este aspecto:
   ```
   postgresql://postgres:[TU-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
5. Reemplaza `[TU-PASSWORD]` por la contraseña que pusiste en el paso anterior.
6. **Guarda esta URL**, la usarás en Railway.

### 2.3 Inicializar el schema

Desde tu máquina local, con el proyecto clonado:

```bash
# Entra a la carpeta del backend
cd backend

# Crea un .env temporal solo para este paso
# (o edita el .env existente con la DATABASE_URL de Supabase)
```

Edita `backend/.env` y añade (o reemplaza las variables DB_*):

```env
DATABASE_URL=postgresql://postgres:[TU-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
NODE_ENV=production
```

Ahora aplica el schema y los datos semilla:

```bash
npm run db:init
npm run db:seed
```

Deberías ver:
```
✅ Schema aplicado correctamente.
✅ Datos semilla insertados (materials, machines, locations, inventory).
✅ Usuarios creados (admin/0000, jefe1/1111, peon1/2222, peon2/3333).
```

> Puedes verificarlo en Supabase: **Table Editor** → verás todas las tablas creadas.

---

## 3. Railway — Backend

### 3.1 Crear cuenta y proyecto

1. Ve a [railway.app](https://railway.app) y entra con tu cuenta de GitHub.
2. Pulsa **New Project → Deploy from GitHub repo**.
3. Selecciona el repositorio `auto-tasky`.
4. Railway detectará el repositorio. **No pulses Deploy aún.**

### 3.2 Configurar el directorio raíz

1. En el proyecto recién creado, pulsa el servicio creado → **Settings**.
2. Busca **Root Directory** y escribe: `backend`
3. Pulsa **Save**.

> Railway leerá el `railway.toml` que hay dentro de `backend/` y sabrá que el comando de inicio es `npm start`.

### 3.3 Añadir variables de entorno

1. Ve a la pestaña **Variables** del servicio.
2. Pulsa **Add Variable** y añade una a una (o usa **Raw Editor** para pegar todo de golpe):

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:[TU-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
JWT_SECRET=pon-aqui-un-secreto-largo-y-aleatorio-minimo-32-caracteres
JWT_EXPIRES_IN=8h
MAX_ACTIVE_TASKS_PER_USER=1
PORT=3000
```

> Para `JWT_SECRET` puedes generar uno seguro en tu terminal:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

### 3.4 Hacer el primer deploy

1. Ve a la pestaña **Deploy** y pulsa **Deploy Now** (o haz un `git push` y Railway lo detecta automáticamente).
2. Espera ~2 minutos. Verás los logs en tiempo real.
3. Cuando aparezca `AUTO-TASKY backend corriendo en http://localhost:3000`, el deploy ha ido bien.

### 3.5 Obtener la URL pública del backend

1. Ve a **Settings → Networking**.
2. En **Public Networking**, pulsa **Generate Domain**.
3. Te dará una URL similar a:
   ```
   https://auto-tasky-production-xxxx.up.railway.app
   ```
4. **Copia esta URL**, la necesitarás en Netlify.

### 3.6 Verificar el backend

Abre en el navegador:
```
https://TU-BACKEND.up.railway.app/api/auth/login
```
Deberías ver un error JSON (`method not allowed` o similar), lo que confirma que el servidor responde.

---

## 4. Netlify — Frontend

### 4.1 Actualizar la URL del backend en el frontend

Antes de hacer deploy, debes decirle al frontend dónde está el backend.

Edita el archivo `frontend/.env.production`:

```env
VITE_API_URL=https://TU-BACKEND.up.railway.app/api
```

Sustituye `TU-BACKEND.up.railway.app` por la URL real que te dio Railway.

Haz commit y push de este cambio:

```bash
git add frontend/.env.production
git commit -m "chore: set production API URL"
git push
```

### 4.2 Crear proyecto en Netlify

1. Ve a [netlify.com](https://netlify.com) y entra con GitHub.
2. Pulsa **Add new site → Import an existing project**.
3. Elige **Deploy with GitHub** y selecciona `auto-tasky`.
4. Netlify detectará el `netlify.toml` automáticamente. Verifica que muestra:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. Pulsa **Deploy site**.

### 4.3 Esperar el build

El build tarda ~1-2 minutos. Cuando termine verás:
```
Site is live
```
Y una URL tipo `https://auto-tasky-xxxx.netlify.app`.

### 4.4 (Opcional) Añadir dominio personalizado

En Netlify: **Site settings → Domain management → Add custom domain**.

---

## 5. Variables de entorno — resumen

### Backend (Railway)

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Connection string de Supabase |
| `JWT_SECRET` | Secreto aleatorio (mín. 32 chars) |
| `JWT_EXPIRES_IN` | `8h` |
| `MAX_ACTIVE_TASKS_PER_USER` | `1` |
| `PORT` | `3000` |

### Frontend (Netlify)

El frontend usa el archivo `frontend/.env.production` que ya está en el repositorio.
Si prefieres no commitear ese archivo, también puedes añadir la variable en Netlify:

**Netlify → Site settings → Environment variables:**

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://TU-BACKEND.up.railway.app/api` |

> Si usas variables en Netlify UI en lugar del archivo, elimina `frontend/.env.production` del repo para evitar conflictos.

---

## 6. Verificar que todo funciona

### Test rápido desde el navegador

1. Abre la URL de Netlify.
2. Deberías ver la pantalla de login de AUTO-TASKY.
3. Inicia sesión con `admin` / PIN `0000`.
4. Navega por las secciones: Tareas, Inventario, Logs, Admin.

### Test manual de la API

```bash
# Login
curl -X POST https://TU-BACKEND.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","pin":"0000"}'

# Respuesta esperada: {"token":"eyJ..."}
```

### Errores comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Pantalla en blanco | `VITE_API_URL` mal configurada | Revisa `frontend/.env.production` y haz redeploy en Netlify |
| `401 Unauthorized` en todas las peticiones | `JWT_SECRET` distinto al usado en el schema | Verifica la variable en Railway |
| `500 Internal Server Error` | `DATABASE_URL` incorrecta o SSL | Revisa la connection string en Railway Variables |
| Login funciona pero datos vacíos | El seed no se aplicó | Vuelve a ejecutar `npm run db:seed` desde local con la `DATABASE_URL` de Supabase |
| CORS error en el navegador | URL del backend sin `/api` al final | Verifica que `VITE_API_URL` termina en `/api` |

---

## 7. Comandos útiles post-deploy

### Re-aplicar schema (si cambias `schema.sql`)

```bash
cd backend
# Con DATABASE_URL de Supabase en el .env:
npm run db:init
```

### Re-ejecutar seed

```bash
cd backend
npm run db:seed
```

### Ver logs del backend en tiempo real

En Railway: **panel del servicio → pestaña Deployments → View Logs**

### Forzar redeploy sin cambios de código

- **Railway**: Settings → Deploy → `Trigger Redeploy`
- **Netlify**: Deploys → `Trigger deploy → Deploy site`

---

## Flujo de deploy continuo (CD)

Una vez configurado todo, cada vez que hagas `git push` a `main`:

- Railway detecta el push y redespliega el backend automáticamente.
- Netlify detecta el push y reconstruye el frontend automáticamente.

No necesitas hacer nada más.
