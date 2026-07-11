output "instance_ip" {
  description = "IP publique de l'instance Contabo"
  value       = contabo_instance.default.ip_config[0].v4[0].ip
}

output "instance_id" {
  description = "ID de l'instance Contabo"
  value       = contabo_instance.default.id
}

output "dns_record" {
  description = "Enregistrement DNS Cloudflare créé"
  value       = "${cloudflare_record.app.name}.${data.cloudflare_zone.domain.name}"
}

output "cloudflare_zone_id" {
  description = "ID de la zone Cloudflare"
  value       = data.cloudflare_zone.domain.id
}

output "origin_ca_cert" {
  description = "Certificat Origin CA (PEM)"
  value       = cloudflare_origin_ca_certificate.app.certificate
  sensitive   = true
}

output "origin_ca_key" {
  description = "Clé privée Origin CA (PEM)"
  value       = tls_private_key.origin_ca.private_key_pem
  sensitive   = true
}
