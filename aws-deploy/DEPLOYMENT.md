# U Signal AWS deployment

## Current server update: 2026-10-23

The current application server is `54.253.181.9`. Playlist availability and individual playlist-item scheduling were deployed to `/opt/usignal` on this host. Existing display/group schedule behavior is preserved. Manage availability from **Schedule playlist** in Playlist Studio and **Schedule media** in slide properties; see the local application's README for the scheduling rules.

Public application: https://54.253.181.9/ · Player: https://54.253.181.9/player

HTTPS was repaired with user authorization: the expired certificate for the former address was replaced with a short-lived certificate for `54.253.181.9`, and Nginx's server names and HTTP redirect were updated to this IP. Public HTTPS returned 200 with successful certificate verification; unauthenticated `/api/state` returned 401. The existing twice-daily renewal timer remains enabled, and the renewal dry run passed. The current certificate expires on 2026-10-30; renewal must remain operational. Prior Nginx and renewal configuration copies are included in the backup directory below. If the public IP changes again, update the certificate and Nginx configuration for the new IP.

All ten tests passed on Ubuntu before installation. The service and Nginx were active after deployment, the new assets were served successfully, and database foreign-key checks passed. Record counts remained unchanged: 4 playlists, 14 items, 13 media files, 5 displays, 3 groups, 2 locations, 1 schedule, and 2 audio tracks. Source and a consistent SQLite backup are stored in `/var/backups/usignal/content-scheduling-20261023T170532Z` on the server (root-only). Uploaded media remains in `/var/lib/usignal/media` and was not changed.

The notes below describe the earlier deployment and its former addresses.

Public application: https://3.107.225.115/
Display player: https://3.107.225.115/player

- SSH user: ubuntu. SSH key stays on the original Windows computer.
- Application: /opt/usignal
- Database and media: /var/lib/usignal (owned by the restricted usignal account)
- Service: usignal.service, enabled at boot and restarted on failure
- Node.js: 24.21.0, installed from nodejs.org with SHA-256 verification
- Reverse proxy: /etc/nginx/conf.d/usignal.conf
- Node listens only on 127.0.0.1:43210; Nginx handles public HTTP/HTTPS.
- HTTP redirects to HTTPS. Existing administrator credentials were copied. Existing login sessions and pending pairing codes were cleared only in the cloud snapshot.
- Certificate: /etc/letsencrypt/live/usignal-ip/; automatically checked for renewal by usignal-cert-renew.timer twice daily. The renewal deploy hook reloads Nginx.
- Remote source adds TRUST_PROXY support for per-client rate limiting, trusted only on the loopback connection from Nginx. Public /api/setup is blocked.

Operations over SSH:

    sudo systemctl status usignal nginx
    sudo systemctl restart usignal
    sudo journalctl -u usignal -n 100 --no-pager
    sudo systemctl list-timers usignal-cert-renew.timer
    sudo /opt/certbot/bin/certbot renew --dry-run --no-random-sleep-on-renew

Open the cloud player URL on each screen and pair it through the cloud dashboard. Browser pairing is specific to each origin; the former localhost address is separate.

This is a snapshot replica, not ongoing synchronization. Changes on the Windows copy and AWS copy are independent. Keep future content changes on the intended server.

## Verified deployment outcome

Public HTTPS returned HTTP 200. Unauthenticated state access returned 401; public administrator setup returned 403. All 12 transferred media files passed SHA-256 checks. Application integration tests passed on Ubuntu; service startup/restart and certificate renewal dry-run succeeded.

After replication, the user intentionally deleted the cloud content and explicitly requested keeping the cloud site empty. Those changes were preserved. The original Windows database and the deployment snapshot remain unchanged.

## Scheduling and display profiles (2026-10-05)

Deployed scheduling for displays and groups with weekly days, local times, optional inclusive dates, IANA timezone, priority, and enabled state. Default timezone is Asia/Kolkata. Display schedules override group schedules; higher priority wins within a target. Equal priorities resolve deterministically by ID. Overnight periods use the starting date/day; matching times mean 24 hours. End times are exclusive. Outside a schedule, the usual display/group playlist resumes. Players evaluate changes through server sync every 3 seconds; a connection is required for schedule changes.

Reusable display profiles include 600x800, 800x1024, HD, Full HD, QHD, UHD 4K and cinema 4K, including portrait options. Custom profiles support 100–4096 pixels per dimension and at most 4096x2160 total pixels. Assign in Manage display and select the corresponding profile in Playlist Studio preview. Canvas dimensions scale to fit without altering OS resolution. Display Play/Pause controls deployed in this release.

Backup: /home/ubuntu/usignal-before-scheduling-20261005T170443Z (source archive and consistent SQLite backup, root-only). Existing content preserved. Seven tests passed locally and on Ubuntu; browser checks passed for scheduling forms, profile assignment, portrait/rotation rendering, preview and mobile layout. Refresh dashboard and existing player pages once to load updated JavaScript.
