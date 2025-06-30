# Multi-stage build for worker-service
FROM node:22.16.0 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/worker-service/package*.json ./services/worker-service/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/worker-service/package*.json ./services/worker-service/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY packages/shared ./packages/shared
COPY services/worker-service ./services/worker-service

# Build shared package first
WORKDIR /app/packages/shared
# Generate Prisma client with a temporary DATABASE_URL for build
ENV DATABASE_URL="postgresql://temp:temp@localhost:5432/temp"
RUN npx prisma generate
RUN npm run build

# Build worker service
WORKDIR /app/services/worker-service
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/services/worker-service/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared/dist ./packages/shared/dist

# Copy full node_modules with generated Prisma client from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy package.json files
COPY --chown=nestjs:nodejs services/worker-service/package*.json ./
COPY --chown=nestjs:nodejs packages/shared/package*.json ./packages/shared/

# Copy Prisma schema files (no generate in runtime)
COPY --chown=nestjs:nodejs packages/shared/prisma ./packages/shared/prisma

# Set environment variables
ENV NODE_ENV=production
ENV WORKER_SERVICE_PORT=3003

# Expose port
EXPOSE 3003

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Start the application
CMD ["sh", "-c", "npx prisma generate --schema=./packages/shared/prisma/schema.prisma && node dist/main.js"]
