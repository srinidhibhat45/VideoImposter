---
name: Alibi
description: A playable online party-game lobby with an arcade identity.
colors:
  background: "#12141b"
  header: "#171a23"
  surface: "#202531"
  stage: "#1e2431"
  ink: "#f4f5fa"
  muted: "#a6adbd"
  secondary-text: "#b4c4da"
  line: "#3b4557"
  accent: "#b9f64a"
  action: "#b9f64a"
  action-hover: "#ccff77"
  action-ink: "#161b20"
  input: "#171d29"
  input-line: "#47556d"
  violet: "#b49aff"
  cyan: "#67d9e2"
  coral: "#ff8c76"
  gold: "#ffd46a"
typography:
  display:
    fontFamily: "Barlow Condensed, Manrope, sans-serif"
    fontSize: "96px"
    fontWeight: 900
    lineHeight: 0.88
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Barlow Condensed, Manrope, sans-serif"
    fontSize: "44px"
    fontWeight: 900
    lineHeight: 1
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "12px"
    lineHeight: 1.9
rounded:
  control: "8px"
  card: "12px"
  panel: "14px"
spacing:
  desktop-gutter: "48px"
  mobile-gutter: "18px"
  column-gap: "22px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  lobby-stage:
    backgroundColor: "{colors.stage}"
    rounded: "{rounded.panel}"
  input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

# Alibi: party-game lobby

## Overview

The user explicitly rejected the former ivory/sage editorial design as resembling a hotel booking website. The replacement is a playable social-deduction game: charcoal panels, acid-green actions, dense arcade lettering, expressive eye avatars, and an immediate create/join/solo-play path. The old design is not visual authority.

## Colors

Charcoal surfaces and cool near-white text frame acid-green primary actions and readiness. Violet, cyan, coral, and gold distinguish player avatars; gold also identifies the host. Slate surface, border, and muted-text variants in `src/game.css` are intentional context-specific ramps around the canonical colors above.

## Typography

Self-hosted Barlow Condensed Black gives headings, player-card names, and pack titles a compact arcade voice. Manrope remains the readable UI/body face. Display caps are deliberate, with italic emphasis reserved for branding and the lobby headline. Monospace remains limited to codes and timers. Compact pack labels and decorative player-card metadata use smaller type than live controls.

## Layout

Desktop: compact game navigation, a bold lobby heading, then a broad game stage with a fixed-width 326px entry/chat panel. The introductory stage pairs “TRUST / NO ONE.” with a fan of five geometric player cards. A different clip is illustrated only in the labeled five-player example. Joined rooms use the actual roster without displaying any secret role. Player seats and voice controls sit under the stage; clip packs resemble selectable game expansions. On phones, a compact ready/start control sits directly beneath the room heading so gameplay does not require scrolling through the introduction or chat.

Phone at 650px and below: create/join comes before the introductory stage. Inside a room, the active stage comes first, then player seats, then chat. Seats use a three-column layout. Clip packs use two columns with the mixed pack spanning the first row. Intermediate tablet widths stack the title and squad graphic within the game stage.

## Elevation & Depth

Tonal panels and thin slate borders establish depth. Primary buttons and the entry panel have no drop shadow. The introductory squad cards use a restrained dark shadow to make the fan legible.

## Shapes

Controls use 8px corners, collection cards 12px, and desktop panels 14px. The player faces use asymmetric rounded corners and a dark visor. Player-card tilt belongs to the introductory squad; usable controls stay aligned.

## Components

Primary actions have acid-green fills with dark ink, generous hit areas, and a restrained pressed state. Hover lifts the button 2px; press moves it 1px down. Secondary actions use slate panels. Keyboard focus uses a bright green outline. Chat, settings, errors, clues, voting, and reveal screens use the same dark game system.

GameFace is a crisp, code-native avatar glyph: one rounded colored tile, a dark visor, two eyes, and a small mouth. It scales from the introductory squad to actual player seats. It is not a photograph or a fabricated remote participant. Eyes blink on a 6-second cycle; reduced-motion preference disables animation and transitions.

## Do's and Don'ts

- Do extend `src/game.css`, which is imported after the structural baseline in `src/styles.css`, for future UI changes.
- Do keep ready/start directly below the joined-room heading on phones.
- Do use photography for real clip collections and YouTube reveal thumbnails.
- Don't reintroduce cream surfaces, small hospitality-style entry headings, or food photography as the primary hero.
- Don't reveal secret roles through actual roster art; the coral different-clip card belongs only to the labeled five-player example.

Secret assignments, simultaneous clues, voting, timers, online room behavior, and call logic are preserved.
