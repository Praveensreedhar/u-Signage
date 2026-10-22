#!/bin/bash
set -euo pipefail
if [ -e /opt/usignal/server.mjs ]; then echo 'Existing application found; stopping before overwrite.'; exit 1; fi
python3 - <<'PY'
import urllib.request,hashlib,pathlib,tarfile
base='https://nodejs.org/dist/latest-v24.x/'
sums=urllib.request.urlopen(base+'SHASUMS256.txt').read().decode()
line=next(line for line in sums.splitlines() if line.endswith('-linux-x64.tar.xz'))
digest,name=line.split()
archive=pathlib.Path('/tmp')/name
urllib.request.urlretrieve(base+name,archive)
assert hashlib.sha256(archive.read_bytes()).hexdigest()==digest,'Node checksum mismatch'
with tarfile.open(archive) as tf: tf.extractall('/opt',filter='data')
link=pathlib.Path('/usr/local/bin/node')
if link.exists() or link.is_symlink(): link.unlink()
link.symlink_to(pathlib.Path('/opt')/name.removesuffix('.tar.xz')/'bin/node')
PY
/usr/local/bin/node --version
id usignal >/dev/null 2>&1 || useradd --system --home /var/lib/usignal --shell /usr/sbin/nologin usignal
install -d -m 755 /opt/usignal
chmod 600 /home/ubuntu/usignal.tar.gz
tar -xzf /home/ubuntu/usignal.tar.gz -C /opt/usignal
if [ -e /var/lib/usignal ]; then echo 'Existing data directory found; stopping.'; exit 1; fi
mv /opt/usignal/data /var/lib/usignal
chown -R usignal:usignal /var/lib/usignal
chmod 700 /var/lib/usignal
chown -R root:root /opt/usignal
python3 - <<'PY'
from pathlib import Path
p=Path('/opt/usignal/server.mjs')
s=p.read_text()
s=s.replace("key + req.socket.remoteAddress", "key + (process.env.TRUST_PROXY === '1' && local(req) ? (req.headers['x-real-ip'] || req.socket.remoteAddress) : req.socket.remoteAddress)")
p.write_text(s)
PY
cat >/etc/systemd/system/usignal.service <<'UNIT'
[Unit]
Description=U Signal digital signage
After=network.target
[Service]
Type=simple
User=usignal
Group=usignal
WorkingDirectory=/opt/usignal
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=43210
Environment=DATA_DIR=/var/lib/usignal
Environment=SECURE_COOKIE=1
Environment=TRUST_PROXY=1
ExecStart=/usr/local/bin/node /opt/usignal/server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/usignal
UMask=0077
[Install]
WantedBy=multi-user.target
UNIT
install -d -m 755 /var/www/usignal-acme
if [ -L /etc/nginx/sites-enabled/default ]; then unlink /etc/nginx/sites-enabled/default; fi
cat >/etc/nginx/conf.d/usignal.conf <<'NGINX'
log_format usignal '$remote_addr [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent';
limit_req_zone $binary_remote_addr zone=usignal_login:10m rate=5r/m;
server {
 listen 80 default_server;
 server_name 16.176.149.184;
 location /.well-known/acme-challenge/ { root /var/www/usignal-acme; }
 location / { return 503 'U Signal deployment in progress'; add_header Content-Type text/plain; }
}
NGINX
nginx -t
systemctl daemon-reload
systemctl enable --now usignal nginx
systemctl reload nginx
cd /opt/usignal
/usr/local/bin/node --test test/*.test.mjs
curl --fail --silent http://127.0.0.1:43210/api/auth
/opt/certbot/bin/certbot certonly --non-interactive --agree-tos --register-unsafely-without-email --preferred-profile shortlived --webroot --webroot-path /var/www/usignal-acme --ip-address 16.176.149.184 --cert-name usignal-ip --deploy-hook 'systemctl reload nginx'
cat >/etc/nginx/conf.d/usignal.conf <<'NGINX'
log_format usignal '$remote_addr [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent';
limit_req_zone $binary_remote_addr zone=usignal_login:10m rate=5r/m;
server {
 listen 80 default_server;
 server_name 16.176.149.184;
 location /.well-known/acme-challenge/ { root /var/www/usignal-acme; }
 location / { return 301 https://16.176.149.184$request_uri; }
}
server {
 listen 443 ssl default_server;
 server_name 16.176.149.184;
 ssl_certificate /etc/letsencrypt/live/usignal-ip/fullchain.pem;
 ssl_certificate_key /etc/letsencrypt/live/usignal-ip/privkey.pem;
 ssl_protocols TLSv1.2 TLSv1.3;
 server_tokens off;
 client_max_body_size 250m;
 client_body_timeout 300s;
 access_log /var/log/nginx/usignal-access.log usignal;
 location = /api/setup { return 403; }
 location = /api/login {
  limit_req zone=usignal_login burst=10 nodelay;
  limit_req_status 429;
  proxy_pass http://127.0.0.1:43210;
  proxy_set_header Host $http_host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-Proto https;
 }
 location / {
  proxy_pass http://127.0.0.1:43210;
  proxy_set_header Host $http_host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-Proto https;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  proxy_request_buffering off;
 }
}
NGINX
nginx -t
systemctl reload nginx
cat >/etc/systemd/system/usignal-cert-renew.service <<'UNIT'
[Unit]
Description=Renew U Signal HTTPS certificate
[Service]
Type=oneshot
ExecStart=/opt/certbot/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
UNIT
cat >/etc/systemd/system/usignal-cert-renew.timer <<'UNIT'
[Unit]
Description=Check U Signal certificate renewal twice daily
[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl disable --now certbot.timer
systemctl daemon-reload
systemctl enable --now usignal-cert-renew.timer
systemctl is-active usignal nginx
systemctl is-enabled usignal usignal-cert-renew.timer
curl --fail --silent https://16.176.149.184/api/auth
