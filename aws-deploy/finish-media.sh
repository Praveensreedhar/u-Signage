#!/bin/bash
set -euo pipefail
cd /home/ubuntu
head -c 74252288 usignal.tar.gz > usignal-complete.tar.gz
cat part00 part01 part02 part03 part04 part05 part06 part07 >> usignal-complete.tar.gz
printf '%s\n' 'a522a6d3a4ada98fe90d0a3421af45b5c25060e8faec886cdaf755a9405fae12  usignal-complete.tar.gz' | sha256sum -c -
chmod 600 usignal-complete.tar.gz
sudo tar -xzf usignal-complete.tar.gz -C /var/lib/usignal --strip-components=2 ./data/media
sudo chown -R usignal:usignal /var/lib/usignal/media
sudo python3 - <<'PY'
import json,hashlib,pathlib,sqlite3
root=pathlib.Path('/var/lib/usignal/media')
expected=json.loads(pathlib.Path('/home/ubuntu/media-checksums.json').read_text())
for entry in expected:
    file=root/entry['file']
    assert file.is_file(),f'Missing media: {entry["file"]}'
    assert hashlib.sha256(file.read_bytes()).hexdigest()==entry['sha256'],f'Corrupt media: {entry["file"]}'
db=sqlite3.connect('file:/var/lib/usignal/signage.sqlite?mode=ro',uri=True)
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
for name, in db.execute('select file from media'):
    assert (root/name).is_file(),f'Database media missing: {name}'
print(json.dumps({'verified_media_files':len(expected),'playlists':db.execute('select count(*) from playlists').fetchone()[0],'slides':db.execute('select count(*) from items').fetchone()[0],'database':'ok'}))
PY
sudo systemctl restart usignal
sleep 2
curl --fail --silent https://16.176.149.184/api/auth
