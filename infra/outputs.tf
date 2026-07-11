output "server_ip" {
  description = "IP publique de la VPS"
  value       = hcloud_server.default.ipv4_address
}

output "server_id" {
  description = "ID du serveur Hetzner"
  value       = hcloud_server.default.id
}

output "dns_record" {
  description = "Enregistrement DNS Cloudflare créé"
  value       = "${cloudflare_record.app.name}.${data.cloudflare_zone.domain.name}"
}

output "cloudflare_zone_id" {
  description = "ID de la zone Cloudflare"
  value       = data.cloudflare_zone.domain.id
}
