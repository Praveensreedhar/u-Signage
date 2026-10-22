# U Signal signage

A local digital signage server with browser players for Windows and Raspberry Pi. Requires Node.js 24 or newer; there are no npm dependencies to install.

## Start on this Windows computer

Double-click `start-windows.cmd`, or run `node server.mjs` in this folder. Keep the server running.

- Management: http://localhost:43210/
- Local test player: http://localhost:43210/player

Create your administrator password from the management page on the server computer. Add locations and groups, upload images/videos, create playlists, and assign a playlist to a group. Open the player, then use **Add display** in the management page to enter its pairing code. Assign its group and location. A display playlist overrides the group playlist; choose **Use group playlist** to restore inheritance.

## Other displays

On each Windows or Raspberry Pi device, open `http://SERVER-LAN-IP:43210/player` in a current browser. `localhost` always refers to the device you are using, so replace it with this server computer's LAN IP on other devices. Both machines need network connectivity. If Windows Firewall blocks the connection, allow TCP port 43210 for your private network.

Use fullscreen or the browser's kiosk mode on each display. Pairing is stored in that browser profile; use a dedicated, persistent profile, not private browsing. Each physical display should have its own browser profile. A local player tab is suitable for testing. Images use the configured duration; videos play to the end muted. Video codec support depends on the browser and hardware; H.264 MP4 is a practical starting format to test. Raspberry Pi hardware playback has not yet been verified.

Updates arrive within approximately 15 seconds. Online status means a player contacted the server within 45 seconds; it does not verify that the physical panel is powered on. Clearing browser storage requires pairing again.

## Data and migration to Linux

Configuration, administrator credentials, and media are in `data/`. Back up this entire folder while the server is stopped. To migrate, stop the server, copy this application folder including `data/` to Linux, install Node.js 24 or newer, and run `sh start-linux.sh`. Update player addresses to the new host and pair again if the address changes, because browser credentials are origin-specific. Keep the backup until the migrated server and players are verified.

Optional environment variables: `PORT` (default 43210), `HOST` (default 0.0.0.0), `DATA_DIR` (default ./data), and `SECURE_COOKIE=1` when serving through HTTPS. A Dockerfile is included but has not been tested here. Initialize the administrator with a direct localhost run before moving the data into Docker; first-time setup only accepts loopback clients.

This version is intended for trusted local-network testing. For remote locations, the players need a reachable server through a private network/VPN or a properly configured HTTPS deployment. Public internet deployment, unattended OS kiosk startup, guaranteed offline media storage, schedules, audio, and multi-user roles are not configured in this version. Existing cached media may play during a brief outage, but offline playback is not guaranteed.

## Verify

Run `npm test` (or `node --test test/server.test.mjs`). The integration test uses a separate temporary database and checks authentication, pairing, group inheritance, display overrides, file uploads, byte-range delivery, persistence across restart, and revocation. It does not replace testing with your actual videos and Raspberry Pi/Windows hardware.

If an older application appears on a reused localhost port, use the current port above. U Signal was moved from 3210 to 43210 to separate it from the older site's browser storage/cache.

## Slide timing and transitions

Under Playlists, use Edit on a slide to set its duration (1–3600 seconds) and incoming transition: None, Fade, Slide left, or Zoom in. Transition duration is adjustable from 0.1 to 10 seconds, included in the incoming slide duration and capped at its playback length. Videos default to playing to the end; choose Use slide duration for a timed video, which loops when shorter than the duration. Existing slides retain instant transitions and full-video playback. Refresh existing player tabs once after this application update.

The playlist editor includes a horizontal thumbnail timeline and selected-clip preview. Drag clips to reorder, or use the earlier/later buttons. Click the + between clips to choose a transition and its duration. The first + applies when the playlist loops from the last clip back to the first. Transitions travel with their incoming clip when it is moved. Timeline widths are not a duration scale.

## Scene audio

Upload MP3, WAV, OGG, or M4A using Upload audio below the timeline or the media library. Click Add audio underneath a scene to attach a file, set volume (0–100%), and choose play once or loop. Select No audio to detach it. Audio follows its scene when reordered, starts from the beginning when that scene appears, and stops at the scene boundary. Source video audio remains muted. If the browser blocks sound, click Enable scene audio on the player. Codec support depends on the player browser. Audio preview is available in the media library; the selected visual preview does not mix in scene audio.

## Playlist audio mixer

Use Add audio track below the visual timeline to layer multiple music, narration, or ambience files. Each track can start at a scene and finish after another scene, or at Playlist end. Extend to end keeps a track assigned through the end as scenes are added. Enable looping to fill the range with a shorter audio file. Multiple tracks and any scene audio play together. Tracks follow numbered scene positions when scenes are reordered.

Each track offers volume, fade-in/out (0–60 seconds), and a Bass boost, Voice clarity, or Telephone filter. Fade-out is limited to the final scene of its range, capped at that scene’s length. Audio restarts at each playlist loop. Source video audio stays muted. Click Enable audio on the player if browser autoplay or the audio context is blocked. Timeline preview does not audition the mixed effects. For voice-over or music mixing, start with lower track volumes; a master compressor limits overlapping peaks.

## Text overlays

Select a slide in Playlists and click Text overlay. Turn it on, enter up to 1000 characters, choose Top, Center, or Bottom, and set text size, color, and an optional dark background. Text size is a percentage of display width. Use line breaks for multiple lines; text exceeding the screen area is clipped, so check your target display.

Choose None, Fade in, Slide up, Slide from left, or Zoom in, with a duration of 0.1–10 seconds. The entrance animation starts with the slide and is capped at its duration; the text stays until the slide ends. Replay the animation in the preview before saving. Turn the overlay off to retain its settings without displaying it. Refresh existing dashboard and player pages after installing this update.
