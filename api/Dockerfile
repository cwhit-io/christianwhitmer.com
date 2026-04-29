FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build TypeScript API
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Build React CMS
COPY cms ./cms
RUN cd cms && npm ci && npm run build

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

# Copy built React CMS
COPY --from=builder /app/cms/dist ./cms/dist

# Ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
