terraform {
  required_providers {
    contabo = {
      source  = "contabo/contabo"
      version = "~> 0.1"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "contabo" {
  oauth2_client_id     = var.client_id
  oauth2_client_secret = var.client_secret
  api_user             = var.api_user
  api_password         = var.api_password
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
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

  user_data = base64encode(templatefile("${path.module}/../cloud-init.sh", {
    domain            = var.domain
    postgres_password = var.postgres_password
    jwt_secret        = var.jwt_secret
    origin_cert       = base64encode(cloudflare_origin_ca_certificate.app.certificate)
    origin_key        = base64encode(tls_private_key.origin_ca.private_key_pem)
  }))
}
