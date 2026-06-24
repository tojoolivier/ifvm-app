#!/bin/bash
set -e

# --- Setup Docker ---
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

# --- Deploy app ---
APP_DIR="/opt/app"
mkdir -p "$APP_DIR"

cd "$APP_DIR"

# Create .env file
cat > .env <<EOF
POSTGRES_DB=ifvm_db
POSTGRES_USER=ifvm
POSTGRES_PASSWORD=${postgres_password}
JWT_SECRET=${jwt_secret}
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
VITE_API_URL=http://${domain}
EOF

# Clone or pull repo (replace with your actual repo URL)
if [ ! -d ".git" ]; then
  git clone https://github.com/olivierrakotondravao/ifvm.git .
else
  git pull origin main
fi

# Start services
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

# --- Backup cron (daily pg_dump) ---
apt-get install -y postgresql-client

CRON_CMD="0 3 * * * docker compose -f $APP_DIR/docker-compose.prod.yml exec -T db pg_dump -U ifvm ifvm_db | gzip > /var/backups/ifvm/db_$$(date +\%Y\%m\%d).sql.gz"
mkdir -p /var/backups/ifvm
(crontab -l 2>/dev/null | grep -v "ifvm"; echo "$CRON_CMD") | crontab -

echo "Deployment complete!"
