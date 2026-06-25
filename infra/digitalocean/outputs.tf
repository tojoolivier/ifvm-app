output "droplet_ip" {
  description = "IP publique du Droplet"
  value       = digitalocean_droplet.default.ipv4_address
}

output "droplet_id" {
  description = "ID du Droplet DigitalOcean"
  value       = digitalocean_droplet.default.id
}
