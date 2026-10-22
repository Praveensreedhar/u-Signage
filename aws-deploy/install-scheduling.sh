#!/bin/bash
set -euo pipefail
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=/home/ubuntu/usignal-before-scheduling-$stamp
mkdir -m 700 "$backup"
tar -czf "$backup/source.tar.gz" -C /opt/usignal .
python3 - "$backup/data.sqlite" <<'PY'
import sqlite3,sys
with sqlite3.connect('/var/lib/usignal/signage.sqlite') as source, sqlite3.connect(sys.argv[1]) as dest:
    source.backup(dest)
PY
chmod 600 "$backup"/*
stage=$(mktemp -d /tmp/usignal-schedule-XXXXXX)
cp -a /opt/usignal/. "$stage/"
tar -xzf /home/ubuntu/scheduling-update.tar.gz -C "$stage"
cd "$stage"
/usr/local/bin/node --check server.mjs
/usr/local/bin/node --check public/app.js
/usr/local/bin/node --test test/*.test.mjs
for file in server.mjs schedule-settings.mjs public/app.js public/index.html public/style.css public/player.js public/audio-mixer.js public/playback-clock.js public/scheduling.js test/server.test.mjs test/mixer.test.mjs test/scheduling.test.mjs; do
 install -o root -g root -m 644 "$stage/$file" "/opt/usignal/$file"
done
systemctl daemon-reload
systemctl restart usignal
sleep 2
systemctl is-active usignal nginx
curl --fail --silent http://127.0.0.1:43210/scheduling.js >/dev/null
echo "Backup: $backup"
