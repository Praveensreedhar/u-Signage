#!/usr/bin/env bash
set -Eeuo pipefail

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
if [[ ${1:-} == --help ]]; then
  printf '%s\n' 'Usage: sudo bash deploy/install-ubuntu.sh' \
    'Installs dependencies, tests and deploys overlay-update, then enables usignal.service.' \
    'Requires Ubuntu 22.04+ with systemd on x86_64 or ARM64. Keeps existing data and settings.'
  exit 0
fi
[[ $# == 0 ]] || fail 'Unknown argument. Use --help.'
[[ $EUID == 0 ]] || fail 'Run with sudo bash deploy/install-ubuntu.sh'
[[ -r /etc/os-release ]] || fail 'Cannot identify the operating system.'
source /etc/os-release
[[ ${ID:-} == ubuntu ]] || fail 'This installer supports Ubuntu.'
[[ ${VERSION_ID%%.*} -ge 22 ]] || fail 'Ubuntu 22.04 or newer is required.'
[[ -d /run/systemd/system ]] || fail 'A running systemd installation is required.'
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64|arm64) arch=arm64 ;;
  *) fail 'Supported CPU architectures: x86_64 and ARM64.' ;;
esac
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source_dir=$(cd -- "$script_dir/../overlay-update" && pwd)
[[ -f $source_dir/server.mjs && -f $source_dir/package.json ]] || fail 'Application source is missing.'
if [[ -e /opt/usignal && ! -L /opt/usignal ]]; then
  fail '/opt/usignal is an existing directory. Back up and migrate the older installation first; see deploy/README.md.'
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
mapfile -t packages < <(sed '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "$script_dir/ubuntu-packages.txt")
apt-get install -y --no-install-recommends "${packages[@]}"

# Download from a version-specific URL after selecting the current Node 24 release.
# Checking the archive against Node's HTTPS checksum manifest catches corruption.
download_dir=$(mktemp -d /tmp/usignal-download.XXXXXXXX)
trap 'rm -rf -- "$download_dir"' EXIT
curl --fail --show-error --silent --location --retry 3 \
  https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$download_dir/latest-sums.txt"
archive=$(awk -v suffix="-linux-${arch}.tar.xz" '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-linux-/ && substr($2,length($2)-length(suffix)+1)==suffix { print $2; exit }' "$download_dir/latest-sums.txt")
[[ $archive =~ ^node-v24\.[0-9]+\.[0-9]+-linux-${arch}\.tar\.xz$ ]] || fail 'No matching Node 24 download found.'
version=${archive#node-}
version=${version%-linux-*}
node_base="https://nodejs.org/dist/$version"
curl --fail --show-error --silent --location --retry 3 "$node_base/SHASUMS256.txt" -o "$download_dir/sums.txt"
curl --fail --show-error --silent --location --retry 3 "$node_base/$archive" -o "$download_dir/$archive"
awk -v name="$archive" '$2==name {print}' "$download_dir/sums.txt" > "$download_dir/selected-sum.txt"
[[ -s $download_dir/selected-sum.txt ]] || fail 'Missing Node checksum.'
(cd "$download_dir" && sha256sum --check selected-sum.txt)
runtime="/opt/usignal-node-${version}-${arch}"
if [[ ! -d $runtime ]]; then
  tar -xJf "$download_dir/$archive" -C "$download_dir"
  mv -- "$download_dir/${archive%.tar.xz}" "$runtime"
  chown -R root:root "$runtime"
  chmod -R go-w "$runtime"
fi
"$runtime/bin/node" --version

getent group usignal >/dev/null || groupadd --system usignal
id usignal >/dev/null 2>&1 || useradd --system --gid usignal --home-dir /var/lib/usignal --shell /usr/sbin/nologin usignal
install -d -m 700 -o usignal -g usignal /var/lib/usignal
install -d -m 755 /opt/usignal-releases /etc/usignal
release=$(mktemp -d /opt/usignal-releases/release-XXXXXXXX)
chmod 755 "$release"
rsync -r --exclude=data/ --exclude=node_modules/ --exclude='*.log' \
  --exclude='browser-test-data/' --exclude='browser-box-test-*/' --exclude='studio-test-*/' \
  "$source_dir/" "$release/"
chown -R root:root "$release"
chmod -R u=rwX,go=rX "$release"
ln -s "$runtime" "$release/node"
printf '\nRunning application tests before switching releases...\n'
(cd "$release" && runuser -u usignal -- "$runtime/bin/node" --test test/*.test.mjs)

if [[ ! -e /etc/usignal/usignal.env ]]; then
  install -m 600 "$script_dir/usignal.env.example" /etc/usignal/usignal.env
fi
install -m 644 "$script_dir/usignal.service" /etc/systemd/system/usignal.service
previous=$(readlink -f /opt/usignal 2>/dev/null || true)
# A temporary link and rename switch application files together.
ln -s "$release" "$release/current-link"
mv -Tf -- "$release/current-link" /opt/usignal
systemctl daemon-reload
systemctl enable usignal.service
healthy=0
if systemctl restart usignal.service; then
  # Load only HOST and PORT for the local health check; never execute the env file.
  port=$(sed -n 's/^PORT=//p' /etc/usignal/usignal.env | tail -n 1)
  host=$(sed -n 's/^HOST=//p' /etc/usignal/usignal.env | tail -n 1)
  port=${port:-43210}
  host=${host:-0.0.0.0}
  case "$host" in
    0.0.0.0|localhost) health_host=127.0.0.1 ;;
    ::) health_host='[::1]' ;;
    *:*) health_host="[$host]" ;;
    *) health_host=$host ;;
  esac
  for attempt in {1..20}; do
    if systemctl is-active --quiet usignal.service && \
      curl --noproxy '*' --fail --silent --max-time 2 "http://$health_host:$port/api/auth" > "$download_dir/health.json"; then
      healthy=1
      break
    fi
    sleep 1
  done
fi
if [[ $healthy != 1 ]]; then
  journalctl -u usignal.service -n 30 --no-pager >&2 || true
  if [[ -n $previous && -d $previous ]]; then
    ln -s "$previous" "$release/previous-link"
    mv -Tf -- "$release/previous-link" /opt/usignal
    systemctl restart usignal.service || true
    printf 'Restored previous application files. Database migrations are not rolled back.\n' >&2
  else
    systemctl stop usignal.service || true
  fi
  fail 'Application health check failed. See the service logs above.'
fi
printf '\nDeployment complete. Service starts automatically at boot.\n'
printf 'Application port: %s\nData: /var/lib/usignal\nSettings: /etc/usignal/usignal.env\n' "$port"
printf 'Open http://YOUR-UBUNTU-IP:%s/ (or localhost on Ubuntu).\n' "$port"
printf 'First-time remote admin setup requires an SSH tunnel; see deploy/README.md.\n'
