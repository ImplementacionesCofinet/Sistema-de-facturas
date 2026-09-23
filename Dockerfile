# =============================================================================
# Imagen de la aplicacion. Se construye una sola vez y se copia al servidor
# de la empresa; alli no hace falta ni compilador ni acceso a npm.
# =============================================================================

# --- 1. Dependencias ---------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Reintentos y esperas amplias para redes lentas o con proxy corporativo.
# La concurrencia se deja en el valor por defecto: bajarla no ahorra memoria de
# forma apreciable y multiplica el tiempo cuando la red es el cuello de botella.
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=60000 \
    NPM_CONFIG_FETCH_TIMEOUT=600000

COPY package.json package-lock.json ./

# Certificado de la CA de la empresa, si la red inspecciona el trafico HTTPS.
# Sin el, npm falla aqui con SELF_SIGNED_CERT_IN_CHAIN: Windows confia en esa
# CA pero el contenedor no la conoce. Ver certs/LEEME.md.
COPY certs/ /certs/

# La cache de npm se conserva entre construcciones: si una falla a medio camino,
# la siguiente reaprovecha lo ya descargado en vez de empezar de cero.
RUN --mount=type=cache,target=/root/.npm \
    if [ -s /certs/ca-corporativa.crt ]; then \
      echo "Usando la CA corporativa de certs/ca-corporativa.crt"; \
      export NODE_EXTRA_CA_CERTS=/certs/ca-corporativa.crt; \
    fi; \
    npm ci --no-audit --no-fund

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

# public/ puede venir vacia de un clon; el COPY de la etapa final la exige.
RUN mkdir -p public && npm run build

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
# Modulos que la app comparte con los scripts de linea de comandos (hashing de
# contrasenas, migraciones). Van en JavaScript plano justamente para esto.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/*.mjs ./src/lib/

RUN mkdir -p /datos/adjuntos && chown -R nextjs:nodejs /datos

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
