output "instance_ip" {
  description = "IP publique de l'instance Contabo"
  value       = contabo_instance.default.ip_config[0].v4[0].ip
}

output "instance_id" {
  description = "ID de l'instance Contabo"
  value       = contabo_instance.default.id
}
