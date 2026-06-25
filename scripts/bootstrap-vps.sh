#!/bin/bash
# Usage: bash bootstrap-vps.sh
# À lancer une seule fois sur la VPS existante (Contabo ou autre) en tant que root.
set -euo pipefail

# --- Paramètres ---
read -rp "Domaine (ex: app.example.com) : " DOMAIN
read -rsp "Mot de passe PostgreSQL        : " POSTGRES_PASSWORD; echo
read -rsp "Secret JWT (min 32 chars)      : " JWT_SECRET; echo

APP_DIR="/opt/app"
REPO_URL="https://github.com/olivierrakotondravao/ifvm.git"

# --- Docker ---
if ! command -v docker &>/dev/null; then
  echo ">>> Installation de Docker..."
  apt-get update -q
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -q
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  echo ">>> Docker installé."
else
  echo ">>> Docker déjà présent, on passe."
fi

# --- Firewall (ufw) ---
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  echo ">>> ufw activé (22, 80, 443)."
fi

# --- App ---
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -d ".git" ]; then
  git clone "$REPO_URL" .
else
  git pull origin main
fi

cat > .env <<EOF
POSTGRES_DB=ifvm_db
POSTGRES_USER=ifvm
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
VITE_API_URL=http://${DOMAIN}
EOF

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

# --- Backup cron ---
apt-get install -y postgresql-client -q
mkdir -p /var/backups/ifvm
CRON_CMD="0 3 * * * docker compose -f $APP_DIR/docker-compose.prod.yml exec -T db pg_dump -U ifvm ifvm_db | gzip > /var/backups/ifvm/db_\$(date +\%Y\%m\%d).sql.gz"
(crontab -l 2>/dev/null | grep -v "ifvm"; echo "$CRON_CMD") | crontab -

echo ""
echo "=== Bootstrap terminé ==="
echo "Application disponible sur http://${DOMAIN}"
echo "Pour les déploiements suivants, GitHub Actions s'en charge automatiquement."
echo "Ajoute VPS_IP=$(curl -s ifconfig.me) et SSH_PRIVATE_KEY dans les secrets GitHub."
