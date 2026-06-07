# My Game — Suki Engine starter

Copy this folder to start a new Stake-shaped browser game.

**URL cheat sheet:** [../../DEV-URLS.md](../../DEV-URLS.md) Outcomes come from the mock RGS; your client only presents `round.state` book events.

## Quick start

```bash
npm install
npm start
```

Open http://127.0.0.1:5174/?dev=true

| URL flag | Purpose |
|----------|---------|
| `?dev=true` | Mock RGS, compliance footer, test buttons, Stake screen toolbar |
| `?dev=true&screen=popout-s` | Start in Popout S (400 × 225) |
| `?dev=true&jurisdiction=strict` | Session timer + disabled turbo/autoplay |
| `?dev=true&social=true` | Social casino copy (coins / play) |
| `?dev=true&lang=de` | German UI strings |
| `?replay=true&event=…` | Replay a completed round |

## Bet modes (buy feature scaffold)

The template ships **base** + **buy bonus** (100× base bet) wired through Suki:

| File | Role |
|------|------|
| `data/index.json` | Math modes (`base`, `bonus`) + book/weight paths |
| `js/config.js` | `GAME_MODES` — keep in sync with `index.json` |
| `server/game-rgs.mjs` | `betModes` on authenticate + mode-aware `resolvePlay` |
| `js/game.js` | Mode selector UI → `game.betModes.setActiveMode()` |

After auth, `lifecycle.executeDrop()` debits `baseBet × costMultiplier` and sends the correct RGS `mode`.

Preview buy gating: `?dev=true&jurisdiction=strict` (disables buy when `disabledBuyFeature` is on).

## Rename checklist (game #2 in ~10 min)

1. **`js/config.js`** — `GAME.id`, `GAME.title`, RTP label, `GAME_MODES`
2. **`server/game-rgs.mjs`** — `GAME_ID`, `REPLAY_VERSION`, `betModes`, mode packs
3. **`js/game.js`** — `sessionStorageKey`, book event handlers (`gameReveal` → your types)
4. **`data/`** — `index.json`, lookup CSV, books JSONL per mode
5. **`package.json`** — `name` field

When publishing outside this monorepo, point Suki at GitHub:

```json
"@kap-solo/suki-engine": "github:kap-solo/suki-engine#main"
```

## Stake layout shell

The template ships with Suki’s **Mobile L-first** layout and **`createBetUi`** betting controls (see main README). Gameplay goes in `.suki-game-core`; replace backgrounds and character flank. Betting UI mounts in `#bet-ui-root` — restyle via `betUi.css` when you finalize the template look.

Test with `?dev=true` and cycle **mobile-l**, **mobile-s**, **desktop**, and **popout-s**.

## Project layout

```
index.html          — Stake shell + import map + stakeLayout.css
css/style.css       — game presentation (HUD, stage, controls)
js/
  config.js         — game constants (rename first)
  game.js           — presentation + createGameBootstrap wiring
  round.js          — parse round.state / buildSettledResult
data/               — math bundle (validate before ship)
server/
  game-rgs.mjs      — LUT pick + books (server-side only)
server.mjs          — static host + RGS routes
```

## Math bundle

Stub ships with 3 equal-weight outcomes (0×, 1×, 2×). Validate locally:

```bash
npm run validate-math
```

From Suki Engine repo:

```bash
npm run validate-math -- template/new-game/data
```

## What you keep vs replace

| Keep (Suki) | Replace (your game) |
|-------------|---------------------|
| `createGameBootstrap`, lifecycle, RGS transport | Book event handlers |
| Jurisdiction, errors, replay, currency, i18n | Canvas / DOM presentation |
| `server.mjs` + `createSukiHost` | `resolvePlay` / math files in `data/` |

## Compliance

```bash
cd ../../
npm run check -- --math template/new-game/data
```

Generates a one-page report for provider outlines.
