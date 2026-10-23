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

## Playlist and individual media scheduling

In **Playlist Studio**, choose **Schedule playlist** to set when that assigned playlist may play on any display. Select a slide and choose **Schedule media** in its properties to set windows for that individual item. The same uploaded file can have different schedules in different playlist items.

Use **New schedule** to add multiple windows with weekdays, local start/end times, optional first/last dates, and a timezone. Both the playlist and the item must be available for the item to play. Multiple enabled windows on the same target are combined: any active window allows playback. With no enabled windows, content is unrestricted; disabling all windows removes the restriction. Delete all windows to return content to always available.

Outside its windows, an item and its attached scene audio are skipped. Playlist audio stays aligned with the remaining scenes. If the playlist is outside its windows or all its items are unavailable, the player waits and resumes automatically when content becomes available. The editor preview continues to show every item so you can design the entire playlist.

The existing **Display / Group** schedule targets continue to choose the playlist with the same precedence and priority rules. The selected playlist's availability and each item's availability then apply. Content windows do not need a display target and do not use priority. End times are exclusive, overnight windows belong to the starting day, and matching start/end times mean a 24-hour window. Schedule changes reach connected players on their next sync (about three seconds); a connection is needed for changes. A playing item may be interrupted when its window ends.

Use the **Schedules** navigation entry to see all rules, or the playlist/media buttons to see just that target's rules. Moving a playlist item to a different playlist carries its windows with it; deleting the item removes its windows. Duplicating a slide creates an unrestricted new item, so configure its windows separately if needed.

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

### Freely positioned text boxes
Open Text overlay and drag the outlined box anywhere in the preview. Drag any of its eight handles to resize from an edge or corner. Arrow keys move the focused box; Shift + arrow keys resize it. Position and dimensions are saved as percentages of the display, so they scale with screen resolution. Text wraps inside the box; increase its height or reduce text size if text is clipped. Existing overlays retain their original placement until edited and saved.

## Multiple text tracks

The playlist timeline now includes TEXT TRACKS above the audio mixer. Select a slide and choose Add text to selected slide to create another text box (up to 20 per slide). Text boxes appear as T1, T2, and so on, aligned under their slide. Click a text clip to edit its content, alignment, color, animation, and draggable/resizable box. The live preview shows all text boxes together. Higher numbered boxes appear in front. Use the × on a text clip to remove it. Existing single text overlays remain available as T1. Text tracks follow their slide when reordered and show for that slide’s duration.

## Playlist Studio

The playlist workspace uses a three-panel editing layout: searchable media library, program preview, and slide properties. Click a visual asset to append it to the playlist; click an audio asset to attach it to the selected slide. Import media accepts the same supported file formats as the media library. Use the properties panel to apply duration and transition changes, duplicate a slide, replace its media, and manage text or scene audio.

The stacked timeline contains V1 (video/images), T1/T2/etc. (text), playlist audio tracks, and scene audio. Drag visual clips to reorder them; their text and scene audio follow. Playlist audio still follows numbered scene ranges as before. Click a transition badge to edit it. Timeline zoom changes clip width for editing; widths represent slide order rather than proportional duration.

Program preview plays visual media, slide transitions, and text effects from the selected slide through the end. Play/pause, previous/next, and Replay effects are available. Preview audio is muted. Full videos run until their end; timed videos loop for their slide duration. Landscape/portrait preview changes only the preview canvas, not display rotation. Use a paired player for the complete audio playback test. Saved edits continue to reach connected players within about 15 seconds.
