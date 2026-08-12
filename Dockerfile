# =============================================
# Multi-stage Dockerfile for Road Accident Data Hub
# Stage 1: Build frontend
# Stage 2: Build backend
# Stage 3: Production runtime
# =============================================

# --- Stage 1: Build frontend ---
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# --- Stage 2: Build backend ---
FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ .
RUN npx tsc

# --- Stage 3: Production ---
FROM node:22-alpine AS production
RUN apk add --no-cache ghostscript vips yara
WORKDIR /app

# Copy backend build
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/package.json ./backend/package.json
COPY --from=backend-build /app/backend/templates ./backend/templates
COPY --from=backend-build /app/backend/yara-rules ./backend/yara-rules

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist ./dist

# Create uploads + quarantine directories
RUN mkdir -p /app/backend/uploads/signed-copies /app/backend/uploads/quarantine/original /app/backend/uploads/quarantine/sanitized && chown -R node:node /app/backend/uploads

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node
CMD ["node", "dist/index.js"]
