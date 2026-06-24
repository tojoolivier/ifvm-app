output "server_ip" {
  description = "IP publique de la VPS"
  value       = hcloud_server.default.ipv4_address
}

output "server_id" {
  description = "ID du serveur Hetzner"
  value       = hcloud_server.default.id
}
