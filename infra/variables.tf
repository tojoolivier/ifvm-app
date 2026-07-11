variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "Clé publique SSH pour accéder à la VPS"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Nom de domaine de l'application"
  type        = string
}

variable "cloudflare_zone_name" {
  description = "Nom de la zone Cloudflare (domaine racine)"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Token API Cloudflare avec permissions DNS + Origin CA"
  type        = string
  sensitive   = true
}

variable "server_type" {
  description = "Type de serveur Hetzner"
  type        = string
  default     = "cpx31"
}

variable "location" {
  description = "Datacenter Hetzner"
  type        = string
  default     = "fsn1"
}

variable "postgres_password" {
  description = "Mot de passe PostgreSQL"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret JWT pour l'authentification"
  type        = string
  sensitive   = true
}
