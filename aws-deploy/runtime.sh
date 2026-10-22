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
