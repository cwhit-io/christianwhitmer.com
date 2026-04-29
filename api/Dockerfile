FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Build CMS frontend if present
# Copy full cms source so frontend install/build hooks have files available
COPY cms ./cms
RUN if [ -f ./cms/package.json ]; then \
            cd cms && if [ -f ./package-lock.json ]; then npm ci; else npm install; fi && npm run build; \
        fi

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=builder /app/dist ./dist
# Copy built CMS frontend (if present)
COPY --from=builder /app/cms/dist ./cms/dist

# Ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
