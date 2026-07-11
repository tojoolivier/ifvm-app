resource "tls_private_key" "origin_ca" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "origin_ca" {
  private_key_pem = tls_private_key.origin_ca.private_key_pem

  subject {
    common_name  = var.domain
    organization = "IFVM"
  }
}

resource "cloudflare_origin_ca_certificate" "app" {
  csr                = tls_cert_request.origin_ca.cert_request_pem
  hostnames          = [var.domain]
  request_type       = "origin-rsa"
  requested_validity = 5475
}

data "cloudflare_zone" "domain" {
  name = var.cloudflare_zone_name
}

resource "cloudflare_record" "app" {
  zone_id = data.cloudflare_zone.domain.id
  name    = trimsuffix(var.domain, ".${var.cloudflare_zone_name}") != var.domain ? trimsuffix(var.domain, ".${var.cloudflare_zone_name}") : "@"
  type    = "A"
  value   = hcloud_server.default.ipv4_address
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "www" {
  zone_id = data.cloudflare_zone.domain.id
  name    = var.domain == var.cloudflare_zone_name ? "www" : "www.${trimsuffix(var.domain, ".${var.cloudflare_zone_name}")}"
  type    = "CNAME"
  value   = var.domain
  proxied = true
  ttl     = 1
}
