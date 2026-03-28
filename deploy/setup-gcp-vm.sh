#!/bin/bash
set -euo pipefail

###############################################
# GCP VM Setup Script for Road Accident Data Hub
# Run this on a fresh Ubuntu 22.04+ GCP VM
# Usage: chmod +x setup-gcp-vm.sh && sudo ./setup-gcp-vm.sh
###############################################

echo "=== [1/5] Updating system packages ==="
apt-get update && apt-get upgrade -y

echo "=== [2/5] Installing Docker ==="
# Install Docker if not present
if ! command -v docker &> /dev/null; then
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "Docker installed successfully."
else
    echo "Docker already installed, skipping."
fi

echo "=== [3/5] Installing Git ==="
apt-get install -y git curl

echo "=== [4/5] Creating app user ==="
if ! id "appuser" &>/dev/null; then
    useradd -m -s /bin/bash -G docker appuser
    echo "Created appuser with docker group access."
else
    usermod -aG docker appuser
    echo "appuser already exists, ensured docker group."
fi

echo "=== [5/5] Setting up application directory ==="
APP_DIR="/opt/road-accident-hub"
mkdir -p "$APP_DIR"
chown appuser:appuser "$APP_DIR"

if [ -f "$(dirname "$0")/deploy.sh" ]; then
    cp "$(dirname "$0")/deploy.sh" "$APP_DIR/deploy.sh"
    chown appuser:appuser "$APP_DIR/deploy.sh"
    chmod +x "$APP_DIR/deploy.sh"
fi

echo ""
echo "=============================================="
echo "  VM setup complete!"
echo "  Now run as appuser: sudo su - appuser"
echo "  Then run: /opt/road-accident-hub/deploy.sh"
echo "=============================================="
