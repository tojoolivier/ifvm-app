# Infrastructure - IFVM

Déploiement de l'application IFVM sur **Contabo VPS** + DNS Cloudflare.

## Architecture

- **Compute** : Contabo (provider `contabo/contabo`)
- **DNS** : Cloudflare (provider `cloudflare/cloudflare`)
- **SSL** : Cloudflare Origin CA — certificat 15 ans, pas de renouvellement

## Prérequis

- [Terraform](https://www.terraform.io/downloads.html) >= 1.10
- Compte Contabo avec API credentials (OAuth2 Client ID/Secret + API User/Password)
- Token API Cloudflare avec permissions :
  - Zone → DNS → Edit
  - Zone → SSL and Certificates → Edit
- Domaine configuré sur Cloudflare

## Variables Terraform

| Variable | Description |
|---|---|
| `client_id` | OAuth2 Client ID Contabo |
| `client_secret` | OAuth2 Client Secret Contabo |
| `api_user` | Email compte Contabo |
| `api_password` | Mot de passe compte Contabo |
| `ssh_public_key` | Clé publique SSH |
| `domain` | Domaine de l'application (ex: `valala.orakotondravao.com`) |
| `cloudflare_zone_name` | Zone Cloudflare racine (ex: `orakotondravao.com`) |
| `cloudflare_api_token` | Token API Cloudflare |
| `product_id` | Type VPS Contabo (défaut: `V45`) |
| `region` | Région (défaut: `EU`) |
| `image_id` | Image OS (défaut: `12` = Ubuntu 24.04) |
| `postgres_password` | Mot de passe PostgreSQL |
| `jwt_secret` | Secret JWT |

## Setup

```bash
cp infra/contabo/terraform.tfvars.example infra/contabo/terraform.tfvars
# Remplir les variables
make tf-init-contabo
make tf-plan-contabo
make tf-apply-contabo
```

## Architecture SSL

```
Browser → Cloudflare Edge (SSL public) → Origin CA → VPS Nginx (port 443) → App
```

Le certificat Origin CA est généré par Terraform et injecté sur le VPS via cloud-init.
Cloudflare proxy l'edge (`proxied = true`).

## Pipeline CI/CD

### `infra.yml` — Infrastructure (Terraform Contabo)

- **Push sur `main`** (fichiers `infra/**`) → `terraform apply` auto
- **Pull Request** → `terraform plan` + commentaire PR
- **`workflow_dispatch`** → choix `plan` / `apply` / `destroy`

### `deploy.yml` — Application

- **Push sur `main`** → déploie le code applicatif sur la VPS

## GitHub Secrets & Variables

### Secrets
| Secret | Workflow |
|---|---|
| `CONTABO_CLIENT_ID` | infra |
| `CONTABO_CLIENT_SECRET` | infra |
| `CONTABO_API_USER` | infra |
| `CONTABO_API_PASSWORD` | infra |
| `CLOUDFLARE_API_TOKEN` | infra |
| `SSH_PUBLIC_KEY` | infra |
| `SSH_PRIVATE_KEY` | deploy, bootstrap |
| `VPS_IP` | deploy, bootstrap |
| `POSTGRES_PASSWORD` | infra, deploy, bootstrap |
| `JWT_SECRET` | infra, deploy, bootstrap |

### Variables
| Variable | Workflow |
|---|---|
| `DOMAIN` | infra, deploy |
| `CLOUDFLARE_ZONE_NAME` | infra |

## Migration : serveur existant

Si un serveur existe déjà et qu'on veut ajouter Cloudflare + Origin CA :

```bash
# 1. Importer les ressources existantes
terraform -chdir=infra/contabo import contabo_secret.ssh_key <secret-id>
terraform -chdir=infra/contabo import contabo_instance.default <instance-id>

# 2. Appliquer (ajoute DNS + certificat sans recréer le serveur)
terraform -chdir=infra/contabo apply

# 3. Copier manuellement le certificat sur le serveur existant
terraform -chdir=infra/contabo output -raw origin_cert    # sauvegarder dans origin.pem
terraform -chdir=infra/contabo output -raw origin_key     # sauvegarder dans origin.key
scp origin.pem origin.key root@<VPS_IP>:/etc/nginx/ssl/

# 4. Mettre à jour le docker-compose et redémarrer
ssh root@<VPS_IP> "cd /opt/app && \
  git pull origin main && \
  docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build"
```
