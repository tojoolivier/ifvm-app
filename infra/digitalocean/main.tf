terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.40"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_ssh_key" "default" {
  name       = "ifvm-deploy-key"
  public_key = var.ssh_public_key
}

resource "digitalocean_firewall" "default" {
  name        = "ifvm-firewall"
  droplet_ids = [digitalocean_droplet.default.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_droplet" "default" {
  name      = "ifvm-prod"
  size      = var.droplet_size
  region    = var.region
  image     = "ubuntu-24-04-x64"
  ssh_keys  = [digitalocean_ssh_key.default.fingerprint]

  user_data = templatefile("${path.module}/../cloud-init.sh", {
    domain            = var.domain
    postgres_password = var.postgres_password
    jwt_secret        = var.jwt_secret
  })

  tags = ["env:production", "app:ifvm"]
}
