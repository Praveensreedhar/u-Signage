# Signage

U Signal digital signage project, including the local application, deployment scripts, and source snapshots.

## Project folders

- `overlay-update/`: local application, browser player, editor, and tests. See its README for feature and operating instructions.
- `aws-deploy/`: deployment scripts, deployment notes, application source, and playback release source.
- `backup-before-*/`: source snapshots retained before earlier changes.

## Run locally

Install Node.js 24 or newer, then run from the repository root:

```sh
cd overlay-update
npm ci --omit=dev --ignore-scripts
npm start
```

Open http://localhost:43210/ and create the administrator account locally. The locked dependency manifest installs the XML parser used for RSS/Atom feeds.

To run the application's automated tests:

```sh
cd overlay-update
npm test
```

## Automated Ubuntu installation

On Ubuntu 22.04+ (x86_64 or ARM64), run:

```bash
sudo apt-get update && sudo apt-get install -y git ca-certificates
git clone https://github.com/Praveensreedhar/u-Signage.git
cd u-Signage
sudo bash deploy/install-ubuntu.sh
```

This installs the required packages and Node.js 24, runs the app tests, and enables automatic startup with systemd. See [deployment instructions](deploy/README.md) for first-time admin setup, SSH tunneling, firewall access, updates, settings, and migration of existing media and data.

For subsequent updates, run `git pull --ff-only && sudo bash deploy/install-ubuntu.sh` from the cloned repository.

## Local data and deployment artifacts

Git excludes runtime databases, uploaded media in `data/`, local credentials, logs, temporary browser test data, and generated deployment archives and transfer chunks. These files remain on the original computer and must be backed up separately when migrating an existing installation. Databases can contain administrator credentials and active sessions; do not commit them.

All application, deployment, and source backup folders are included. Some backup folders are partial snapshots and are not standalone applications.
