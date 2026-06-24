terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.50"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

resource "hcloud_ssh_key" "default" {
  name       = "ifvm-deploy-key"
  public_key = var.ssh_public_key
}

resource "hcloud_firewall" "default" {
  name = "ifvm-firewall"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "default" {
  name         = "ifvm-prod"
  server_type  = var.server_type
  location     = var.location
  image        = "ubuntu-24.04"
  ssh_keys     = [hcloud_ssh_key.default.id]
  firewall_ids = [hcloud_firewall.default.id]

  user_data = templatefile("${path.module}/cloud-init.sh", {
    domain            = var.domain
    postgres_password = var.postgres_password
    jwt_secret        = var.jwt_secret
  })

  labels = {
    env  = "production"
    app  = "ifvm"
  }
}
