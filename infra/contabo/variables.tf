variable "client_id" {
  description = "OAuth2 Client ID Contabo"
  type        = string
  sensitive   = true
}

variable "client_secret" {
  description = "OAuth2 Client Secret Contabo"
  type        = string
  sensitive   = true
}

variable "api_user" {
  description = "Email du compte Contabo (API user)"
  type        = string
  sensitive   = true
}

variable "api_password" {
  description = "Mot de passe du compte Contabo (API password)"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "Clé publique SSH pour accéder à l'instance"
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

variable "product_id" {
  description = "ID du produit Contabo (V45=VPS S 4vCPU/8GB, V46=VPS M, V47=VPS L)"
  type        = string
  default     = "V45"
}

variable "region" {
  description = "Région Contabo (EU, US-central, US-east, US-west, SIN, JPN, AUS)"
  type        = string
  default     = "EU"
}

variable "image_id" {
  description = "ID de l'image OS (Ubuntu 24.04 = 12 en EU — vérifier via API Contabo)"
  type        = string
  default     = "12"
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
