#!/bin/bash
set -euo pipefail
backup=/home/ubuntu/usignal-before-effects-$(date +%Y%m%d-%H%M%S).tar.gz
sudo tar -czf "$backup" -C /opt/usignal server.mjs overlay-settings.mjs public test
sudo chmod 600 "$backup"
stage=$(mktemp -d)
tar -xzf /home/ubuntu/effects-update.tar.gz -C "$stage"
sudo python3 - "$stage" <<'PY'
from pathlib import Path
import sys
source=Path('/opt/usignal/server.mjs').read_text()
a="!['cut','fade','slide','zoom'].includes(transition)"
b="'/box-editor.js':'box-editor.js',"
assert a in source and b in source,'Unexpected server version; no files installed'
source="import { slideNames } from './public/transitions.js';\n"+source.replace(a,"!Object.hasOwn(slideNames,transition)").replace(b,b+"'/transitions.js':'transitions.js',")
Path(sys.argv[1],'server.mjs').write_text(source)
PY
cd "$stage"
/usr/local/bin/node --check server.mjs
/usr/local/bin/node --test test/*.test.mjs
sudo cp "$stage/server.mjs" "$stage/overlay-settings.mjs" /opt/usignal/
sudo cp "$stage/public/"* /opt/usignal/public/
sudo cp "$stage/test/server.test.mjs" /opt/usignal/test/
sudo chown -R root:root /opt/usignal
sudo chmod -R u=rwX,go=rX /opt/usignal
sudo systemctl restart usignal
sleep 2
curl --fail --silent https://16.176.149.184/api/auth
