# =============================================
# Multi-stage Dockerfile for Road Accident Data Hub
# Stage 1: Build frontend
# Stage 2: Build backend
# Stage 3: Production runtime
# =============================================

# --- Stage 1: Build frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
RUN npm run build

# --- Stage 2: Build backend ---
FROM node:20-alpine AS backend-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ .
RUN npx tsc

# --- Stage 3: Production ---
FROM node:20-alpine AS production
WORKDIR /app

# Copy backend build
COPY --from=backend-build /app/server/dist ./server/dist
COPY --from=backend-build /app/server/node_modules ./server/node_modules
COPY --from=backend-build /app/server/package.json ./server/package.json
COPY --from=backend-build ["/app/server/DSR on 01-04-2026 to 07-04-2026.xlsx", "./server/DSR on 01-04-2026 to 07-04-2026.xlsx"]

# Copy frontend build
COPY --from=frontend-build /app/dist ./dist

# Create uploads directory
RUN mkdir -p /app/server/uploads/signed-copies && chown -R node:node /app/server/uploads

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node
CMD ["node", "dist/index.js"]
