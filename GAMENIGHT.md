# Play with 6–7 friends on Teams

1. Keep your Teams call open. Open the same **public HTTPS game link**, create a lobby, and use **Invite friends** to share its room link. Each player enters a different name and presses **Ready up**. The host presses **Start game**.
2. **Mute your Teams microphone** and wear headphones. Play your private clip (30 seconds maximum), then submit one word. Never share your screen or show your clip to the group. One randomly selected person gets a different, related video; nobody is told their role.
3. When all clues appear, **unmute Teams**, compare stories, and vote here. The host can open voting early. Votes stay private until everyone votes or time runs out. The reveal shows both clips and the imposter; the host starts the next round.

The in-app call is optional. You do not need to join it when using Teams. The app cannot mute Teams for you.

## Recommended setup

Use **The mixed bag** for the most variety: eight curated pairs, shuffled without immediate repeats when alternatives exist. The music-only pack contains one pair and will repeat. Default rounds use 30-second clips and 90-second discussion. The group moves on as soon as everyone finishes watching/submits/votes; timers prevent a stalled player from holding up the game.

## If something goes wrong

- **A clip will not play:** press **Retry clip** or **Clip won’t play? Tell the host**. The host presses **Replace clips** while watching to give everyone fresh clips in the same round. Scores stay intact. YouTube availability can vary by country.
- **Connection drops:** refresh the same browser tab. Your seat and submissions are saved for 90 seconds. Rejoining with the room code after that is possible between rounds.
- **Someone leaves mid-round:** the group returns to the lobby so everyone gets a fair round. A departing host passes control automatically.
- **Friends cannot join:** share the public link, not a localhost link. New players join in the lobby or after a reveal. The room holds up to eight.

## Temporary public hosting

On macOS with the official `cloudflared` package installed, build once with `npm run build`, then run `npm run game-night -- start`. Share the HTTPS address it prints. The app, tunnel, and sleep prevention run as macOS background jobs independently of the terminal or chat. They do not automatically start after logout or reboot.

Run `npm run game-night -- status` to see the current URL, health, and log directory. Run `npm run game-night -- stop` after playing to stop hosting and release sleep prevention. Starting an already healthy host returns its existing URL; it does not restart active rooms.

The URL lasts only while its tunnel runs; a new tunnel gets a new URL. Keep the Mac plugged in, connected to the internet, and with the lid open. Restarting the app ends rooms. Cloudflare Quick Tunnels have no uptime guarantee; use the Render configuration in README for permanent hosting. A 1033 error means Cloudflare has no working tunnel connection: check status, then stop/start if needed and share the replacement URL.

## Checks performed

32 automated tests pass. Seven independent clients completed watch → private clues → discussion → private votes → reveal through the public HTTPS/WebSocket endpoint. All 16 curated source videos returned available oEmbed metadata at verification time; this does not guarantee embedding in every country. Desktop and phone layouts were reviewed. Seven generated-media clients established all 21 local WebRTC pairs; Teams is the chosen call setup for this game night.
