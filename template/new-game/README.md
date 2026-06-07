# My Game — Suki Engine starter

Copy this folder to start a new Stake-shaped browser game. Outcomes come from the mock RGS; your client only presents `round.state` book events.

## Quick start

```bash
npm install
npm start
```

Open http://127.0.0.1:5174/?dev=true

| URL flag | Purpose |
|----------|---------|
| `?dev=true` | Mock RGS, compliance footer, test buttons |
| `?dev=true&jurisdiction=strict` | Session timer + disabled turbo/autoplay |
| `?dev=true&social=true` | Social casino copy (coins / play) |
| `?dev=true&lang=de` | German UI strings |
| `?replay=true&event=…` | Replay a completed round |

## Rename checklist (game #2 in ~10 min)

1. **`js/config.js`** — `GAME.id`, `GAME.title`, RTP label
2. **`server/game-rgs.mjs`** — `GAME_ID`, `REPLAY_VERSION` (must match config)
3. **`js/game.js`** — `sessionStorageKey`, book event handlers (`gameReveal` → your types)
4. **`data/`** — `index.json`, lookup CSV, books JSONL
5. **`package.json`** — `name` field

When publishing outside this monorepo, point Suki at GitHub:

```json
"@kap-solo/suki-engine": "github:kap-solo/suki-engine#main"
```

## Project layout

```
index.html          — HUD + import map
css/style.css       — minimal shell
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
