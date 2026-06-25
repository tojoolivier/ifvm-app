#!/usr/bin/env bash
# init-ssl.sh — obtenir le premier certificat Let's Encrypt
# Usage : ./infra/scripts/init-ssl.sh <domain> <email>
# Exemple : ./infra/scripts/init-ssl.sh app.ifvm.mg admin@ifvm.mg
#
# Prérequis :
#   - Port 80 accessible depuis Internet (DNS pointant sur ce serveur)
#   - docker et docker compose installés
#   - Fichier .env présent dans infra/ (POSTGRES_PASSWORD, JWT_SECRET…)

set -euo pipefail

DOMAIN="${1:?Argument 1 requis : domaine (ex: app.ifvm.mg)}"
EMAIL="${2:?Argument 2 requis : email Let's Encrypt (ex: admin@ifvm.mg)}"
INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $INFRA_DIR/docker-compose.prod.yml"

cd "$INFRA_DIR"

echo "╔══════════════════════════════════════════════╗"
echo "║  Initialisation HTTPS — Let's Encrypt         ║"
echo "╚══════════════════════════════════════════════╝"
echo "  Domaine : $DOMAIN"
echo "  Email   : $EMAIL"
echo ""

# Étape 1 : config HTTP-only (elle est déjà dans nginx-conf.d/default.conf)
echo "==> 1. Démarrage de nginx en mode HTTP (challenge ACME)..."
$COMPOSE up -d nginx

# Attendre que nginx soit prêt
sleep 3

# Étape 2 : obtention du certificat
echo "==> 2. Obtention du certificat Let's Encrypt pour $DOMAIN..."
$COMPOSE run --rm certbot \
  certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# Étape 3 : génération de la config nginx HTTPS depuis le template
echo "==> 3. Activation de la configuration HTTPS..."
export DOMAIN
envsubst '${DOMAIN}' < "$INFRA_DIR/nginx.conf.template" > "$INFRA_DIR/nginx-conf.d/default.conf"

# Étape 4 : rechargement nginx (relit les fichiers de config sans interruption)
echo "==> 4. Rechargement nginx..."
$COMPOSE exec nginx nginx -s reload

# Étape 5 : démarrer les services restants si ce n'est pas encore fait
echo "==> 5. Démarrage de l'ensemble des services..."
$COMPOSE up -d

echo ""
echo "✓ HTTPS opérationnel sur https://$DOMAIN"
echo ""
echo "  Renouvellement automatique : assuré par le service 'certbot' (toutes les 12h)."
echo "  Pour vérifier l'état des certificats :"
echo "    $COMPOSE run --rm certbot certbot certificates"
