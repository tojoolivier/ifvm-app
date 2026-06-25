variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "Clé publique SSH pour accéder au Droplet"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Nom de domaine de l'application"
  type        = string
  default     = "app.example.com"
}

variable "droplet_size" {
  description = "Taille du Droplet DigitalOcean"
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "region" {
  description = "Région DigitalOcean"
  type        = string
  default     = "fra1"
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
