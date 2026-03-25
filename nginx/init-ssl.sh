#!/bin/sh
# =============================================================
# init-ssl.sh — Nginx SSL entrypoint
#
# Behaviour:
#   • If /etc/nginx/certs/fullchain.pem already exists (real
#     Let's Encrypt or custom cert), nginx starts immediately.
#   • If no certificate is found, a self-signed certificate is
#     generated automatically — safe for development/staging.
#
# Production:
#   Place your real certificates at:
#     /etc/nginx/certs/fullchain.pem
#     /etc/nginx/certs/privkey.pem
#   Or run Certbot with the certbot service in docker-compose
#   and let it write certs to the ssl_certs volume.
# =============================================================

set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  echo "========================================================="
  echo "  SSL: No certificate found."
  echo "  Generating a self-signed certificate for development."
  echo "  IMPORTANT: Replace with a real Let's Encrypt certificate"
  echo "  before deploying to production."
  echo "========================================================="

  mkdir -p "$CERT_DIR"

  # Install openssl if not present (Alpine-based image)
  apk add --no-cache openssl > /dev/null 2>&1 || true

  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/C=JO/ST=Amman/L=Amman/O=DopaWork Dev/CN=localhost" \
    > /dev/null 2>&1

  echo "  Self-signed certificate generated at $CERT_DIR"
  echo "========================================================="
fi

exec nginx -g "daemon off;"
