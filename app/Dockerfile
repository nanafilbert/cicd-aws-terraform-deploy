# ════════════════════════════════════════════════════════════════
# Stage 1 — deps: install production dependencies only
# ════════════════════════════════════════════════════════════════
FROM node:20-alpine3.21 AS deps
RUN apk upgrade --no-cache && npm install -g npm@latest

WORKDIR /app

# Copy lockfiles first to maximise layer caching
COPY package.json package-lock.json ./

# Install production deps only
RUN npm ci --omit=dev && \
    # Clean npm cache to reduce image size
    npm cache clean --force

# ════════════════════════════════════════════════════════════════
# Stage 2 — test: run tests in CI (not included in final image)
# ════════════════════════════════════════════════════════════════
FROM node:20-alpine3.21 AS test
RUN apk upgrade --no-cache && npm install -g npm@latest

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm test -- --ci --forceExit

# ════════════════════════════════════════════════════════════════
# Stage 3 — production: minimal, hardened runtime image
# ════════════════════════════════════════════════════════════════
FROM node:20-alpine3.21 AS production
RUN apk upgrade --no-cache && npm install -g npm@latest

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy production deps from stage 1
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodeuser:nodejs . .

# Drop write permissions on app directory
RUN chmod -R 755 /app && \
    chmod -R 755 /app/node_modules

USER nodeuser

# ── Runtime Config ─────────────────────────────────────────────
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

EXPOSE 3000

# ── Health check ───────────────────────────────────────────────
# Docker daemon runs this every 30s to determine container health
HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=15s \
    --retries=3 \
    CMD wget -qO- http://localhost:3000/health/ready || exit 1

# ── Entrypoint ─────────────────────────────────────────────────
CMD ["node", "src/app.js"]
