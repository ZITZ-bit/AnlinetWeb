# Despliegue del backend en Render — AnlinetWeb

Este documento describe cómo desplegar `apps/backend/` (API NestJS + PostgreSQL/Prisma) como un **Web Service** en Render, conectando el repositorio de GitHub. No se incluyen valores secretos reales.

## Estructura del repositorio

- Monorepo con npm workspaces en la raíz: `apps/*` (`apps/backend`, `apps/frontend`).
- El backend es autónomo: todo su código vive bajo `apps/backend/src/` y sus dependencias se resuelven desde su propio `package.json`. No importa de `apps/frontend/` ni de paquetes de la raíz.
- Lockfile: `package-lock.json` en la raíz (gestión centralizada de workspaces). No se duplica en `apps/backend/`.

## Configuración recomendada en Render

| Campo | Valor |
|-------|-------|
| **Runtime** | Node |
| **Versión de Node** | `>=20` (se declara `"engines": { "node": ">=20.0.0" }` en `apps/backend/package.json`) |
| **Root Directory** | `apps/backend` |
| **Build Command** | `npm run build` |
| **Start Command** | `npm run start:prod` |
| **Instalación de dependencias** | `npm install` (automática de Render) |

Rationale del **Root Directory = `apps/backend`**:
- Evita construir `apps/frontend/` (Next.js) en el servicio del backend.
- No bloquea el acceso a dependencias, porque el backend no importa nada fuera de su propia carpeta.
- Se mantiene un único lockfile en la raíz; Render respeta el `package.json` del directorio raíz del servicio.

## Comandos exactos para Render

- **Build Command:** `npm run build`
  - Ejecuta `prisma generate` (prebuild) y luego `nest build`. Compila a `apps/backend/dist/`.
- **Start Command:** `npm run start:prod`
  - Ejecuta `node dist/main`. Sirve los archivos ya compilados.
- **Migraciones (manual, controlado):** `npx prisma migrate deploy --config prisma/prisma.config.ts`
  - No se ejecuta automáticamente al iniciar el servicio. Ejecutarlo tras el despliegue desde el shell de Render o como paso separado.

## Variables de entorno para Render (Dashboard → Environment)

Configurarlas en Render, nunca subir un `.env` con valores reales al repositorio (`apps/backend/.env` está en `.gitignore`).

| Variable | Obligatoria | Descripción | Ejemplo (placeholder) |
|----------|-------------|-------------|-----------------------|
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL externo (Render: Base de Datos → Internal Database URL) | `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | Sí | Secreto para firmar tokens JWT | `cambiar-por-secreto-fuerte-aleatorio` |
| `ALLOWED_ORIGINS` | Sí (producción) | Orígenes CORS permitidos, separados por coma. Sin comodines en producción. | `https://tu-frontend.onrender.com` |
| `PORT` | No | Render inyecta el puerto. Fallback local `3000`. | — |
| `NODE_ENV` | No | `production` activa validación de variables y CORS restrictivo. | `production` |

## CORS

En `src/main.ts` se lee `ALLOWED_ORIGINS` (lista separada por coma).
- En producción (`NODE_ENV=production`) solo se aceptan los orígenes listados; si no hay ninguno, se bloquean todos (`origin: []`). Nunca `origin: true`.
- En desarrollo sin `ALLOWED_ORIGINS` se permiten por defecto `localhost:3000/3001`.

Configurar en Render el/los dominios del frontend (ej. `https://tu-frontend.onrender.com`).

## Base de datos y migraciones

- ORM: Prisma con proveedor `postgresql` (`prisma/schema.prisma`).
- El cliente de Prisma se genera en `prebuild` (`prisma generate --config prisma/prisma.config.ts`) con salida en `src/generated/prisma` (formato CJS).
- `prisma.config.ts` lee `DATABASE_URL` de variables de entorno (fallback solo a `localhost` para desarrollo local).
- **Migraciones:** ejecutar `prisma migrate deploy` de forma controlada tras el despliegue.
- **Seeders:** no se ejecutan automáticamente al iniciar el servicio. No hay seeder destructivo en el arranque.

## Health check

Endpoint disponible sin autenticación:

- `GET /health`

Respuesta ejemplo:
```json
{
  "status": "ok",
  "timestamp": "2026-11-14T02:00:00.000Z",
  "services": { "database": "ok" }
}
```

`status` = `degraded` si la base de datos no responde. Usarlo para comprobar que el servicio está vivo tras desplegar en Render.

## Procedimiento de despliegue

1. Subir los cambios a la rama `main` de GitHub.
2. En Render: crear un **Web Service** conectando el repositorio.
3. Seleccionar **Root Directory** = `apps/backend`.
4. Configurar **Build Command** = `npm run build` y **Start Command** = `npm run start:prod`.
5. Añadir las variables de entorno de la tabla anterior (sin secretos reales en el código).
6. Desplegar. Render ejecuta `npm install`, luego `npm run build`, y arranca `node dist/main`.
7. Ejecutar migraciones: `npx prisma migrate deploy --config prisma/prisma.config.ts` (shell de Render).
8. Comprobar health check: `GET https://tu-backend.onrender.com/health` debe devolver `200` con `"status": "ok"`.

## Notas y estado de verificación

- Build de producción (`npm run build`): **verificado localmente** (exit 0).
- Lint (`npm run lint`): **verificado localmente** (exit 0, solo advertencias preexistentes).
- Arranque con `node dist/main` (`npm run start:prod`): **por verificar en Render** (no se hizo despliegue real).
- La base de datos de producción debe estar lista antes de arrancar; `PrismaService` se conecta en `onModuleInit`.
- No se probó el despliegue en Render. Validar `DATABASE_URL` y `ALLOWED_ORIGINS` en el dashboard antes de considerar el servicio listo.
