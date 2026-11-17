#!/usr/bin/env bash
# Build and upload the site and (first run) install the nginx config.
# Usage: ./deploy.sh            -> files only
#        ./deploy.sh --first    -> also install nginx + config
set -euo pipefail
HOST=root@115.120.205.56
HERE="$(cd "$(dirname "$0")" && pwd)"

if [[ "${1:-}" == "--first" ]]; then
  ssh "$HOST" 'command -v nginx >/dev/null || (apt-get update && apt-get install -y nginx); mkdir -p /var/www/lonewolf'
  scp "$HERE/nginx-lonewolf.conf" "$HOST:/etc/nginx/sites-available/lonewolf"
  ssh "$HOST" 'ln -sf /etc/nginx/sites-available/lonewolf /etc/nginx/sites-enabled/lonewolf && nginx -t && systemctl reload nginx'
fi

# Build first: the site is a Vite project and only dist/ is served.
npm --prefix "$HERE/../site" run build
tar -C "$HERE/../site/dist" -czf - . | ssh "$HOST" 'mkdir -p /var/www/lonewolf && tar -C /var/www/lonewolf -xzf - && chown -R www-data:www-data /var/www/lonewolf 2>/dev/null || true'
echo "Uploaded. Check http://115.120.205.56/ (Host header: lonewolfdigitech.com)"
