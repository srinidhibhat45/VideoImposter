# Alibi

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
delegated: React and Vite for the interface, Express and Socket.IO for authoritative multiplayer rooms, WebRTC for browser audio/video. The user requested a local preview and delegated the stack.

## Users
Friends playing a social deduction game together in a browser call.

## Product Purpose
Everyone privately watches the same YouTube clip except one randomly assigned player who receives a related, different clip. Everyone submits one relevant word, discusses, and votes for the imposter.

## Operating Context
Create or join a private room, gather 3–8 people, choose a video collection, watch privately, lock a one-word clue, discuss in an in-app call, vote, and reveal both videos and the imposter. A clearly labeled solo practice mode demonstrates the full sequence.

## Capabilities and Constraints
Clips default to 30 seconds and cannot exceed 30 seconds; full-length source videos are played from a chosen start point. Playback automatically marks completion and advances the group to one-word clues when everyone finishes. The watch phase has a 15-second loading allowance. The server controls assignments, phase transitions, clue privacy, and vote tallying. Do not expose the imposter or the alternate video until the reveal. Rotate video pairs without repeats until the chosen pack is exhausted, and avoid consecutive repeated pairs when alternatives exist. Browser history stores up to 64 recently assigned/revealed video IDs across rooms; the server privately prefers unseen or least recent clips. Disclose pack recycling because the curated library is finite. Reset the player and elapsed timer to the assigned segment for every round; never inherit a previous YouTube playback position. No YouTube API key is required for curated embedded clips. Playback depends on YouTube availability and regional/embed restrictions. Calls need browser camera/microphone permission; deployment outside localhost needs HTTPS and production TURN configuration for reliable NAT traversal. Online multiplayer is required: friends join from separate devices over the internet. The local preview is for development; production runs this same server behind HTTPS. Docker and Render configurations are provided. No production hosting account or TURN credentials have been supplied. Rooms are ephemeral and disappear on server restart.

## Brand Commitments
User reference: Sidemen Reacts Imposter Edition game mechanism. Alibi is an independent working name, not an affiliated Sidemen product. Playful, sociable, and slightly suspicious.

The user requested an explicitly playable game identity and rejected the earlier hospitality-like editorial appearance. The current direction is a dark party-game lobby: acid-green actions, bold arcade lettering, colorful eye avatars, clear create/join/solo-play actions, and a prominent live game stage. Keep entry straightforward on mobile and the active game stage prominent once a room is joined.

## Product Principles
- Keep the group together in one place.
- Keep each player's video and clue private until the correct phase.
- Make each round quick to understand and replay.
- Label practice players and simulated behavior honestly.
