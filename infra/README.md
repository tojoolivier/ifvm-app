# Infrastructure - IFVM

Déploiement de l'application IFVM sur Hetzner Cloud.

## Prérequis

- [Terraform](https://www.terraform.io/downloads.html) installé
- Token API Hetzner ([créer ici](https://dns.hetzner.com/settings/api-token))
- Clé SSH publique
- Domaine configuré sur Cloudflare

## Setup

1. Copier le fichier de variables :
   ```bash
   cp infra/terraform.tfvars.example infra/terraform.tfvars
   ```

2. Remplir les variables dans `infra/terraform.tfvars`

3. Initialiser Terraform :
   ```bash
   make tf-init
   ```

4. Voir le plan :
   ```bash
   make tf-plan
   ```

5. Appliquer :
   ```bash
   make tf-apply
   ```

6. Récupérer l'IP :
   ```bash
   make tf-output
   ```

## GitHub Secrets

Configurer ces secrets dans Settings > Secrets :

| Secret | Description |
|--------|-------------|
| `HCLOUD_TOKEN` | Token API Hetzner |
| `VPS_IP` | IP de la VPS (output Terraform) |
| `SSH_PRIVATE_KEY` | Clé privée SSH |

## Déploiement

Le déploiement est automatique : push sur `main` = deploy sur la VPS.

## Commandes utiles

```bash
# Voir les logs
ssh root@<VPS_IP> "cd /opt/app && docker compose -f docker-compose.prod.yml logs -f"

# Restart
ssh root@<VPS_IP> "cd /opt/app && docker compose -f docker-compose.prod.yml restart"

# Destroy
make tf-destroy
```
