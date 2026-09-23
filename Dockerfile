# =============================================================================
# Imagen de la aplicacion. Se construye una sola vez y se copia al servidor
# de la empresa; alli no hace falta ni compilador ni acceso a npm.
# =============================================================================

# --- 1. Dependencias ---------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# npm falla con "Exit handler never called!" cuando se queda sin memoria o se
# le corta una descarga. Estos ajustes bajan la concurrencia, reintentan lo que
# falle y quitan trabajo que no aporta nada dentro de una imagen.
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_MAXSOCKETS=4 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=600000

COPY package.json package-lock.json ./

# Un segundo intento aprovecha lo que quedo en la cache y suele pasar cuando el
# primero murio a medio camino.
RUN npm ci --no-audit --no-fund || npm ci --no-audit --no-fund

# --- 2. Compilacion ----------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valores ficticios: solo se necesitan para que la compilacion resuelva la
# configuracion. Los reales se leen del entorno al arrancar el contenedor.
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    SESSION_SECRET=build-time-placeholder-no-se-usa-en-ejecucion \
    NODE_OPTIONS=--max-old-space-size=3072
RUN npm run build

# --- 3. Ejecucion ------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_LOCAL_DIR=/datos/adjuntos

RUN addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

# Salida "standalone": el servidor con solo las dependencias que realmente usa.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migraciones, semilla y respaldo, para poder ejecutarlos dentro del contenedor.
# La salida standalone ya trae node_modules/pg, que es lo unico que necesitan.
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

RUN mkdir -p /datos/adjuntos && chown -R nextjs:nodejs /datos

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
