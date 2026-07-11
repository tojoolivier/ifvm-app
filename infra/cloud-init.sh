#!/bin/bash
set -e

DOCKER_CONFIG_FILE="/etc/docker/daemon.json"
NGINX_SSL_DIR="/etc/nginx/ssl"

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

# --- Configurer Docker pour utiliser Google DNS ---
mkdir -p /etc/docker
cat > "$DOCKER_CONFIG_FILE" <<EOF
{
  "dns": ["8.8.8.8", "8.8.4.4"]
}
EOF
systemctl restart docker

# --- Préparer le certificat SSL Origin CA ---
mkdir -p "$NGINX_SSL_DIR"
echo "${origin_cert}" | base64 -d > "$NGINX_SSL_DIR/origin.pem"
echo "${origin_key}" | base64 -d > "$NGINX_SSL_DIR/origin.key"
chmod 600 "$NGINX_SSL_DIR/origin.key"
chmod 644 "$NGINX_SSL_DIR/origin.pem"

# --- Deploy app ---
APP_DIR="/opt/app"
mkdir -p "$APP_DIR"

cd "$APP_DIR"

cat > .env <<EOF
POSTGRES_DB=ifvm_db
POSTGRES_USER=ifvm
POSTGRES_PASSWORD=${postgres_password}
JWT_SECRET=${jwt_secret}
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
DOMAIN=${domain}
VITE_API_URL=https://${domain}
EOF

if [ ! -d ".git" ]; then
  git clone git@github.com:tojoolivier/ifvm-app.git .
else
  git pull origin main
fi

docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f infra/docker-compose.prod.yml --env-file .env exec -T backend alembic upgrade head

# --- Backup cron (daily pg_dump) ---
apt-get install -y postgresql-client

CRON_CMD="0 3 * * * docker compose -f $APP_DIR/infra/docker-compose.prod.yml exec -T db pg_dump -U ifvm ifvm_db | gzip > /var/backups/ifvm/db_\$(date +\%Y\%m\%d).sql.gz"
mkdir -p /var/backups/ifvm
(crontab -l 2>/dev/null | grep -v "ifvm"; echo "$CRON_CMD") | crontab -

echo "Deployment complete!"
echo "Site accessible sur https://${domain}"
