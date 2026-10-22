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
npm start
```

Open http://localhost:43210/ and create the administrator account locally. The application has no npm dependencies to install.

To run the application's automated tests:

```sh
cd overlay-update
npm test
```

## Local data and deployment artifacts

Git excludes runtime databases, uploaded media in `data/`, local credentials, logs, temporary browser test data, and generated deployment archives and transfer chunks. These files remain on the original computer and must be backed up separately when migrating an existing installation. Databases can contain administrator credentials and active sessions; do not commit them.

All application, deployment, and source backup folders are included. Some backup folders are partial snapshots and are not standalone applications.
