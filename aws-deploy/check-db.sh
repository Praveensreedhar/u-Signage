#!/bin/bash
set -euo pipefail
checkdir=$(mktemp -d)
tar -xzf /home/ubuntu/usignal-core.tar.gz -C "$checkdir" ./data/signage.sqlite
sudo python3 - "$checkdir/data/signage.sqlite" <<'PY'
import sqlite3,sys,hashlib,json
for filename in [sys.argv[1],'/var/lib/usignal/signage.sqlite']:
 db=sqlite3.connect('file:'+filename+'?mode=ro',uri=True)
 print(json.dumps({'file':filename,'counts':{t:db.execute('select count(*) from '+t).fetchone()[0] for t in ['admin','playlists','items','media','displays']},'admin_digest':hashlib.sha256(str(db.execute('select * from admin').fetchone()).encode()).hexdigest()}))
PY
sudo journalctl -u usignal --no-pager -n 12
