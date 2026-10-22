#!/bin/bash
set -euo pipefail
install -d -m 755 /var/www/usignal-acme
if [ -L /etc/nginx/sites-enabled/default ]; then unlink /etc/nginx/sites-enabled/default; fi
cat >/etc/nginx/conf.d/usignal.conf <<'NGINX'
server {
 listen 80 default_server;
 server_name 16.176.149.184;
 location /.well-known/acme-challenge/ { root /var/www/usignal-acme; }
 location / { return 503 'U Signal deployment in progress'; add_header Content-Type text/plain; }
}
NGINX
nginx -t
systemctl reload nginx
/opt/certbot/bin/certbot certonly --non-interactive --agree-tos --register-unsafely-without-email --preferred-profile shortlived --webroot --webroot-path /var/www/usignal-acme --ip-address 16.176.149.184 --cert-name usignal-ip --deploy-hook 'systemctl reload nginx'
