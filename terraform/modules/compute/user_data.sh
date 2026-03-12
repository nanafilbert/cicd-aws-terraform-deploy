#!/bin/bash
set -euo pipefail

LOG_FILE="/var/log/user-data.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[$(date)] Starting bootstrap for ${app_name}:${app_version}"

# Update system
yum update -y
yum install -y docker aws-cli

# Start Docker
systemctl start docker
systemctl enable docker

# Install Docker Compose v2
COMPOSE_VERSION="v2.23.3"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Pull the image
echo "[$(date)] Pulling image ${dockerhub_username}/${app_name}:${app_version}"
docker pull "${dockerhub_username}/${app_name}:${app_version}"

# Run the container
docker run -d \
  --name "${app_name}" \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e APP_VERSION="${app_version}" \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  "${dockerhub_username}/${app_name}:${app_version}"

# Wait for healthy
echo "[$(date)] Waiting for app to be healthy..."
for i in {1..12}; do
  STATUS=$(curl -s -o /dev/null -w "%%{http_code}" http://localhost:3000/health/ready || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "[$(date)] ✅ App is healthy!"
    exit 0
  fi
  echo "[$(date)] Attempt $i: got $STATUS — retrying..."
  sleep 5
done

echo "[$(date)] ❌ App failed to become healthy"
exit 1
