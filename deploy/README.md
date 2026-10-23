# Automated Ubuntu deployment

## Requirements

- Ubuntu 22.04 or newer with systemd, on x86_64 or ARM64 (64-bit).
- A user with sudo access, Internet access to Ubuntu package mirrors and nodejs.org, and GitHub access to clone this repository.
- A current browser on each display. Allow disk space for your uploaded videos and images.
- Node.js 24, including built-in SQLite, is downloaded and checksum-verified automatically. Locked npm dependencies for RSS parsing are installed automatically from `overlay-update/package-lock.json` with lifecycle scripts disabled. Outbound access to registry.npmjs.org is required. No Python requirements file, separate database server, or Docker installation is needed.
- Ubuntu packages are listed in `ubuntu-packages.txt` and installed automatically. The installer uses the current Node 24 release from the [official Node.js downloads](https://nodejs.org/en/download).

## Install on a new Ubuntu machine

Run these commands as your normal Ubuntu user:

```bash
sudo apt-get update && sudo apt-get install -y git ca-certificates
git clone https://github.com/Praveensreedhar/u-Signage.git
cd u-Signage
sudo bash deploy/install-ubuntu.sh
```

For a private repository, use your configured GitHub SSH access or a GitHub personal access token when Git requests a password. GitHub account passwords cannot authenticate Git operations. Keep credentials out of command lines and files in this repository.

The installer installs system dependencies and a dedicated Node runtime, copies `overlay-update/` into a new release directory, runs its automated tests as the service user, and enables `usignal.service`. The service runs as the restricted `usignal` user and restarts after failures and reboots. Application files are under `/opt/usignal`, settings are in `/etc/usignal/usignal.env`, and persistent data is in `/var/lib/usignal`.

The default deployment serves HTTP on port 43210 for a trusted LAN or VPN. For public Internet access, add an HTTPS reverse proxy before exposing the application. This installer does not configure TLS, change firewall rules, or alter an existing web server. If UFW is enabled, allow TCP port 43210 only from the intended LAN/VPN subnet using `sudo ufw allow from YOUR-SUBNET/CIDR to any port 43210 proto tcp`; configure any cloud firewall separately.

## Create the administrator

On Ubuntu with a desktop, open `http://localhost:43210/` and create an administrator password of at least 12 characters.

For a remote/headless Ubuntu server, run this on your own computer (replace the username and IP):

```bash
ssh -N -L 43211:127.0.0.1:43210 YOUR-UBUNTU-USER@YOUR-UBUNTU-IP
```

Keep SSH running, open `http://localhost:43211/` on your computer, and create the administrator there. Initial setup accepts only loopback requests, which this tunnel supplies. After setup, manage the application at `http://YOUR-UBUNTU-IP:43210/`. Open `http://YOUR-UBUNTU-IP:43210/player` on each display and pair it from the dashboard. If you change the configured port, adjust these URLs and the tunnel's destination port accordingly.

## Update

From the cloned repository, run:

```bash
git pull --ff-only && sudo bash deploy/install-ubuntu.sh
```

Each run downloads the current Node 24 release, tests the new app before switching releases, preserves existing settings and `/var/lib/usignal`, and checks `/api/auth` after restarting. If the check fails, it restores the previous application link when available. It does not reverse database migrations; back up data before updating. Old releases and Node runtimes remain available on disk.

An older deployment using a real `/opt/usignal` directory is deliberately refused. To migrate it, first stop its service and back up its application, settings, and data; move the old application directory to a separate backup path, then run this installer. Review existing HTTPS/proxy settings separately. The `aws-deploy/` scripts are historical scripts for a specific server; use this installer for new Ubuntu machines.

## Settings and service commands

Defaults are documented in `usignal.env.example`. Edit `/etc/usignal/usignal.env` with `sudoedit`, then restart. Keep `DATA_DIR=/var/lib/usignal` because the service sandbox grants write access there. Use plain `KEY=value` lines without quotes for HOST and PORT, with a valid port from 1 to 65535. Bind HOST to `0.0.0.0`, `127.0.0.1`, or a local interface address. For an HTTPS reverse proxy, set `HOST=127.0.0.1`, `SECURE_COOKIE=1`, and enable `TRUST_PROXY=1` only with a trusted loopback proxy that overwrites `X-Real-IP` and blocks public `/api/setup` access. The installer health check uses direct HTTP to the app even when cookies are configured for HTTPS.

```bash
sudo systemctl status usignal --no-pager
sudo systemctl restart usignal
sudo journalctl -u usignal -n 100 --no-pager
sudo journalctl -u usignal -f
```

## Back up or migrate existing data

GitHub contains source code, not your database, administrator credentials, or uploaded media. On an existing Ubuntu installation, stop the service, back up the entire data folder, then start it again:

```bash
sudo systemctl stop usignal
sudo tar -czf /root/usignal-data-$(date +%Y%m%d-%H%M%S).tar.gz -C /var/lib usignal
sudo systemctl start usignal
```

On the new server, stop `usignal`, copy the **contents** of the old application's `data/` folder (or `/var/lib/usignal` on a service deployment) into `/var/lib/usignal`, then run:

```bash
sudo chown -R usignal:usignal /var/lib/usignal
sudo chmod 700 /var/lib/usignal
sudo systemctl start usignal
```

Stop the source server while copying SQLite files, and back up any destination data before replacing it. Include the media directory and SQLite sidecar files if present. Treat the backup as private because it includes login data. Existing content and administrator credentials move with the database; displays need the new server address and may need pairing again.
