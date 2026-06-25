terraform {
  required_providers {
    contabo = {
      source  = "contabo/contabo"
      version = "~> 0.1"
    }
  }
}

provider "contabo" {
  oauth2_client_id     = var.client_id
  oauth2_client_secret = var.client_secret
  api_user             = var.api_user
  api_password         = var.api_password
}

resource "contabo_secret" "ssh_key" {
  name  = "ifvm-deploy-key"
  type  = "ssh"
  value = var.ssh_public_key
}

resource "contabo_instance" "default" {
  display_name = "ifvm-prod"
  product_id   = var.product_id
  region       = var.region
  image_id     = var.image_id

  ssh_keys = [contabo_secret.ssh_key.id]

  # Contabo ne propose pas de cloud firewall managé — le cloud-init configure ufw
  user_data = base64encode(templatefile("${path.module}/../cloud-init.sh", {
    domain            = var.domain
    postgres_password = var.postgres_password
    jwt_secret        = var.jwt_secret
  }))
}
