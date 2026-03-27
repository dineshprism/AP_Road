#!/bin/bash
set -euo pipefail

###############################################
# Deploy / Redeploy the Road Accident Data Hub
# Run as appuser (or any user in docker group)
# Usage: chmod +x deploy.sh && ./deploy.sh
###############################################

APP_DIR="/opt/road-accident-hub"
REPO_URL="https://github.com/dineshprism/AP_Road.git"
ENV_FILE="$APP_DIR/.env"

cd "$APP_DIR"

# --- Clone or pull ---
if [ -d "$APP_DIR/app" ]; then
    echo "=== Pulling latest code ==="
    cd "$APP_DIR/app"
    git pull origin main
else
    echo "=== Cloning repository ==="
    git clone "$REPO_URL" "$APP_DIR/app"
    cd "$APP_DIR/app"
fi

# --- Check .env ---
if [ ! -f "$ENV_FILE" ]; then
    echo ""
    echo "ERROR: .env file not found at $ENV_FILE"
    echo "Create it with:"
    echo ""
    echo "cat > $ENV_FILE << 'EOF'"
    echo 'VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key'
    echo 'DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD'
    echo 'DB_PORT=5433'
    echo 'JWT_SECRET=CHANGE_ME_RANDOM_64_CHAR_STRING'
    echo 'CORS_ORIGIN=http://YOUR_VM_EXTERNAL_IP:3000'
    echo 'EOF'
    echo ""
    exit 1
fi

# Symlink .env into the app directory
ln -sf "$ENV_FILE" "$APP_DIR/app/.env"

# --- Build and start ---
echo "=== Building and starting containers ==="
cd "$APP_DIR/app"
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build

echo ""
echo "=== Waiting for services to be healthy ==="
sleep 10

# Check health
if docker compose ps | grep -q "Up"; then
    echo ""
    echo "=============================================="
    echo "  Deployment successful!"
    echo "  App: http://$(curl -s ifconfig.me):3000"
    echo "=============================================="
    docker compose ps
else
    echo "ERROR: Containers failed to start. Check logs:"
    echo "  docker compose logs"
    exit 1
fi
