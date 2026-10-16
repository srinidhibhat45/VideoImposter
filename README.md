# Alibi

An online video-imposter game for 3–8 friends. Everyone privately watches the same YouTube clip, except one random player who receives a different, related clip. Submit one word, compare clues in the built-in voice/video call, vote, and reveal the imposter.

## Run the development preview

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Choose **Try a practice round** for the complete solo flow with clearly labeled simulated players. To test real multiplayer, create a room and open its invite link in other browser tabs or devices connected to the same running server. Each player uses a separate browser session/tab.

**Localhost is a development preview, not a public invite link.** For friends on different networks, deploy the complete app using the production instructions below. The frontend and room server run together on one HTTPS origin; the app does not use browser-local storage to coordinate players.

## Put it online

This project includes a Dockerfile and a Render Blueprint. It needs a persistent Node web service with WebSocket support, not static-only hosting or a request-limited serverless function.

### Render

1. Push this directory to your own Git repository.
2. Create a Render Blueprint from that repository using `render.yaml`. The included configuration specifies a Starter instance; review the selected plan before creating a paid service. Alternatively, create a Node web service manually with build command `npm ci && npm run build` and start command `npm start`.
3. Keep one running instance. Render supplies the HTTPS URL and `PORT` automatically. Set the health-check path to `/api/health`.
4. Set `ALLOWED_ORIGIN` to your app's HTTPS origin if your proxy uses a different internal Host header. Normal same-origin traffic is accepted by default.
5. Configure a TURN relay (below) for reliable calls across mobile, office, or restrictive home networks.
6. Open the deployed URL, create a room, and share the invite link. Each friend joins the same public HTTPS app from their own device. No account is needed.

No hosting account, domain, deployment credentials, or TURN credentials are bundled. **This repository is online-compatible but is not deployed by this build.**

### Docker / any Node host

```sh
npm ci
npm run build
npm start
```

Or:

```sh
docker build -t alibi .
docker run --env-file .env -e NODE_ENV=production -p 3000:3000 alibi
```

Put an HTTPS reverse proxy in front of the service and allow WebSocket upgrades. The server listens on `0.0.0.0` and uses the provider's `PORT` (3000 by default). For non-Docker local configuration, copy `.env.example` to `.env`; the npm scripts load it automatically.

### Internet calls and TURN

Calls use WebRTC mesh: the app's Socket.IO server carries signaling, while the browsers carry audio/video. The default public STUN server works on many networks. A TURN relay is necessary when direct peer connections are blocked. Obtain credentials from a TURN provider and configure these on your hosting service:

```dotenv
TURN_URL=turn:your-relay.example:3478,turns:your-relay.example:5349
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-credential
```

Use provider credentials intended for browser clients. ICE configuration must reach the browser; do not put a provider's administrative API key here. The room code/session token is not used as a TURN credential. Camera and microphone permissions require HTTPS outside localhost. In watch and clue phases, outbound microphones and remote call audio are muted; the call resumes for discussion.

## Game rules

- One randomly chosen imposter per round. Nobody is told their role.
- The server sends each player only their own assigned video; it never sends unrevealed role or pair data to other players.
- Clips default to 30 seconds, with a hard maximum of 30. Playback stops and marks the player finished automatically; once everyone finishes, submit a single Unicode word (up to 24 characters). A 15-second loading allowance prevents the room from stalling.
- Clues become visible together after everyone submits or the timer expires.
- Discuss by voice/video or room chat. The host may open voting early.
- Each player votes once for another player. Votes remain hidden until the reveal.
- A unique most-voted imposter is caught. A tied vote or no votes lets the imposter escape.
- Correct votes earn 1 point each. An escaping imposter earns 2 points.
- Choose 3, 5, 8, or 10 rounds; 15/20/30-second clips; and 60/90/120/180-second discussions.

## Video collection

Eight curated related pairs across food, wildlife, science, and music. The mixed bag shuffles all eight. Pair selection stays on the server, and a pair does not repeat until its selected collection is exhausted. The base collection uses distinct video IDs across its pairs. This is a curated library, not live YouTube search or a guarantee of never-seen-before videos.

Curated clips use a selected start point and play only the next 15–30 seconds. Custom pairs use the beginning of each video, so full-length YouTube videos work without trimming or uploading.

Hosts can also add up to 20 custom pairs per room using public YouTube links. The server validates links through YouTube oEmbed and chooses the assignments randomly. The host will know a custom pair's contents but not the imposter. Playback uses the official YouTube IFrame API. No videos are downloaded or re-hosted. YouTube availability, ads, regional restrictions, and embedding permissions can change; a failed embed offers an external YouTube link so the player can return and continue.

## Verification

```sh
npm test
npm run build
```

Tests cover private assignments, simultaneous clues, input validation, secret votes, scoring and ties, non-repeating pairs, timers, online readiness, full multi-client rounds, reconnects, host handover, and cross-room signaling isolation.

A development-only call harness is available at `/tests/call-harness.html` when running the Vite development server. It creates synthetic camera/audio tracks and exercises the actual `useCall` hook and WebRTC signaling without requesting the user's devices. It is excluded from production builds. Verified in-browser: two peers reach `connected`, tracks mute during private rounds and resume afterward, individual camera/mic toggles work, and leaving clears remote tracks. Real cross-network calling still needs a deployed HTTPS service and configured TURN relay for testing.

## Current operating limits

Rooms, scores, and custom pairs live in server memory. Restarting or redeploying ends active rooms. Disconnected seats are retained for 90 seconds. Leaving an active round resets it to the lobby; a departing host passes control to another real player. A new player joins between rounds. Use a single server instance until shared room storage and a Socket.IO adapter are added. Eight-way mesh calls depend on each participant's device and connection quality.

Alibi is an independent game inspired by the requested social-deduction format. It is not affiliated with Sidemen or YouTube. Artwork and font provenance are in `public/images/SOURCES.md` and `public/fonts/SOURCES.md`.

Deployment references: [Render Express guide](https://render.com/docs/deploy-node-express-app), [WebSocket support](https://render.com/docs/websocket), and [Blueprint reference](https://render.com/docs/blueprint-spec).
