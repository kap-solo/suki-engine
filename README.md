# Suki Engine

Minimal, Stake-shaped game shell for custom browser games.

**Local URLs, Render links, and Stake screen sizes:** see [DEV-URLS.md](./DEV-URLS.md).

**RGS lifecycle · replay · jurisdiction · mock server**

Games built on Suki handle presentation and math; the engine handles wallet flow, compliance flags, and prototype RGS routes.

## Layout

```
client/
  money.js          — API amount conversion
  rgs.js            — wallet, replay, bet/event transport
  suki/
    config.js       — initSuki(), URL dev flags
    bookPlayer.js   — handler map + resume slicing
    environment.js  — production / development / replay
    errors.js       — ERR_* messages + error policy
    jurisdiction.js — regional UI gating
    bootstrap.js    — authenticate on load
    gameBootstrap.js — createGameBootstrap() single entry point
    lifecycle.js    — play → book events → end-round
    authConfig.js   — parseAuthResponse() from authenticate
    controlPolicy.js — jurisdiction → UI gating helpers
    betModes.js      — createBetModePolicy() for BASE / buy / activate modes
    sessionTimer.js  — createSessionTimer() for displaySessionTimer
    currency.js      — formatCurrencyAmount() from auth currency
    copy.js          — social casino UI terminology
    i18n.js          — createI18n() string lookup
    strings/         — locale tables (en, de scaffold)

tools/
  validate-math.mjs — validate books + lookup bundle

harness/
  smoke.mjs         — compliance smoke tests
  err-scenarios.mjs — ERR_* policy matrix + mock injection

server/
  host.mjs          — static files + RGS routes
  mock-rgs/         — in-memory prototype RGS

template/new-game/  — copy to start a new title
```

## Quick start (new game)

Copy the runnable starter:

```bash
cp -r template/new-game ../my-new-game
cd ../my-new-game
npm install && npm start
```

Open http://127.0.0.1:5174/?dev=true — authenticate, bet, play, and settle work out of the box with stub math (3 outcomes).

See **`template/new-game/README.md`** for the rename checklist (`gameId`, handlers, `data/` books).

When publishing outside this monorepo, set the dependency to `github:kap-solo/suki-engine#main`.

Before shipping:

```bash
npm run validate-math ./data
cd ../Suki-Engine && npm run check -- --math ../my-new-game/data
```

### Publish math to Stake Engine ACP

Stake requires `index.json`, headerless lookup CSVs, and zstd-compressed `*.jsonl.zst` books at the **upload folder root** (not `math/` source scripts).

```bash
# From Suki-Engine (pass your game's data dir)
npm run math:publish -- ../Basic-Slot-Pool/data

# Validate the upload folder matches Stake rules
npm run validate-math -- --stake ../Basic-Slot-Pool/data/publish
```

`tools/publish-math.mjs` strips lookup CSV headers (Stake rejects line 1 if it is not numeric) and writes `data/publish/` ready for ACP upload.

CI on `main` runs full `npm run check` (smoke + ERR + compliance report + template math) and `npm run test:integration` (live host routes via `template/new-game`).

## Tier 2 APIs

- `createGameBootstrap(options)` — initSuki + production shell + jurisdiction + lifecycle + RGS start
- `initStakeLayout()` / `stakeLayout.css` — Mobile L-first shell; orientation + portrait-family context on `main.suki-stake-shell`
- `createBetUi()` / `betUi.css` — standard betting controls (modes, chips, play, dev row); portrait + landscape skins
- `createGameMenu()` / `gameMenu.css` — burger pop-up (How to Play, Paytable, Stats, Recent Results, Music + SFX volume sliders)
- `createModalHost()` — pop-up overlay for menu content
- `createAudioPrefs()` — persisted `musicVolume` / `sfxVolume` (0–1; mute icon sets volume to 0)
- `createGameAudio({ audioPrefs })` — background music loop + `playSfx(name)` scaled to SFX volume
- `createGamePreloader({ shell, onContinue })` — tap-to-continue overlay (audio unlock + `game.start()`)
- `createRecentResultsStore()` — in-memory round history for Recent Results modal
- `STAKE_SCREENS` / `createScreenRegistry()` / `initStakeScreenPreview()` — dev toolbar for Stake Engine iframe sizes (`?dev=true`)
- `createSessionTimer({ element, container, controls })` — elapsed session clock when `displaySessionTimer` is true
- `initStakeLayout()` — mounts a 24-hour wall clock (`HH:MM`) in the shell top-left automatically
- `createCurrencyFormatter({ currency, language })` — Intl + social codes (XGC → GC, XSC → SC); set from auth via `game.formatCurrency()`
- `getPlayerCurrency()` / `setPlayerCurrency()` — URL `?currency=` before auth, `balance.currency` after authenticate; `play()` uses automatically
- `createI18n({ lang, socialCasino })` / `game.t('balance')` — locale strings from `lang` param; add locales in `client/suki/strings/`

### Adding a locale

1. Copy `client/suki/strings/en.js` → `fr.js` (translate `fr` + optional `frSocial`).
2. Register in `strings/index.js` (`PACKS` + `SUPPORTED_LOCALES`).
3. Stake passes `?lang=fr` — `createGameBootstrap` picks it up automatically.

Preview German locally: `?dev=true&lang=de`
- `createCopyPolicy({ socialCasino })` — Bet/Play, Win/Earn, etc.; preview with `?dev=true&social=true`
- `reportBetAction(action, meta)` — `POST /bet/action` for in-round player picks
- `parseAuthResponse(data)` — bet levels, currency, jurisdiction from authenticate
- `createControlPolicy(jurisdiction)` — `canTurbo`, `canAutoplay`, `showRtp`, etc.
- `createBetModePolicy({ authBetModes, gameModes, controls })` — merge math modes + RGS `betModes`; `playAmountApi()`, `rgsModeForPlay()`, buy/activate gating via `disabledBuyFeature`

### Bet modes (buy feature / bonus ready)

Pass math modes from `index.json` and read `game.betModes` after auth:

```js
const game = createGameBootstrap({
  auth: {
    gameModes: [
      { name: 'base', cost: 1 },
      // { name: 'bonus', cost: 100 },  // when math bundle ships
    ],
    onConfigured(auth) { /* bet levels */ },
  },
  // ...
});

// After auth: game.betModes.modes, game.betModes.playAmountApi(baseBetApi)
// lifecycle.executeDrop() debits base × costMultiplier and sends correct RGS mode
// Buy UI: game.betModes.buyModes() gated by game.controls.canBuyFeature
```

```js
import { createGameBootstrap } from '@kap-solo/suki-engine/client/rgs.js';

const game = createGameBootstrap({
  suki: { gameId: 'my-game', replayVersion: '1', sessionStorageKey: 'myGame.rgsSessionID' },
  shell: { elements: { complianceDev: document.getElementById('compliance-dev') } },
  lifecycle: { handlers: { /* book event types */ }, applyBalance, onRoundSettled, setMessage, getBetApi, setBetFromApi, buildSettledResult },
  auth: { onConfigured: (auth) => { /* bet levels, balance */ } },
  ui: { setMessage, syncHud, isBusy: () => false },
  replay: { start: () => bootstrapReplay() },
});

game.syncDevTools();
game.start();
```

## Production mode

Without `?dev=true`, Suki runs in **production** — no mock flags, no dev UI.

```js
import { applyProductionShell } from '@kap-solo/suki-engine/client/rgs.js';

applyProductionShell({
  elements: {
    complianceDev: document.getElementById('compliance-dev'),
    testControls: document.querySelector('.test-row'),
  },
});
```

Mark dev-only nodes with `data-suki-dev` in HTML. Use `?dev=true` locally for compliance footer and test buttons.

## Stake layout shell (template default)

New games copy a **Mobile L-first** shell: gameplay lives in `.suki-game-core` (425×812 reference), controls in `.suki-controls-slot` (bottom on portrait, right on landscape), character slot in `.suki-flank-left`.

| Portrait family | Screens | Background |
|-----------------|---------|------------|
| **mobile-l** | Mobile L | `.suki-bg-mobile-l` (full-bleed tall) |
| **mobile-ms** | Mobile M, Mobile S | `.suki-bg-mobile-ms` (wider; L-proportion core centered) |
| **landscape** | Desktop, laptop, popouts | `.suki-bg-landscape` + flanks |

`createGameBootstrap` calls `initStakeLayout` automatically when `shell.screenPreview.root` (or `shell.stakeLayout.root`) points at `main.suki-stake-shell`. The root gets `data-suki-orientation`, `data-suki-portrait-family`, and CSS vars (`--suki-vw`, `--suki-core-w`, etc.).

**index.html** must include:

```html
<link rel="stylesheet" href="/vendor/suki-engine/client/suki/stakeLayout.css" />
<main class="suki-stake-shell">…</main>
```

Popout S uses the landscape shell but hides the character flank by default — tune per game.

## Standard betting UI

Mount before `createGameBootstrap`, pass `betUi.elements` into `shell.elements`, then `betUi.bind({ game, onPlay, … })`:

```html
<link rel="stylesheet" href="/vendor/suki-engine/client/suki/betUi.css" />
<div class="suki-controls-slot" id="bet-ui-root"></div>
```

```js
const betUi = createBetUi({ root: document.getElementById('bet-ui-root'), showModeRow: true });
const game = createGameBootstrap({ shell: { elements: { dropButton: betUi.elements.dropButton, … } } });
betUi.bind({ game, getBet: () => bet, setBet: (v) => { bet = v; }, onPlay: () => onPlay(), … });
```

Visual design lives in `betUi.css` (functional scaffold today — customize per game via CSS vars or overrides).

## Game burger menu

```html
<link rel="stylesheet" href="/vendor/suki-engine/client/suki/gameMenu.css" />
```

```js
const modalHost = createModalHost({ root: shellEl });
const audioPrefs = createAudioPrefs({ storageKey: `${gameId}.audio` });
const recentResults = createRecentResultsStore({ max: 25 });
const gameMenu = createGameMenu({ brand: brandEl, shell: shellEl, modalHost, audioPrefs });

gameMenu.bind({ game });
modalHost.bind({ game });
modalHost.register('paytable', {
  title: ({ game: g }) => g?.copy?.t('paytableTitle') ?? 'Paytable',
  render: (body) => { /* … */ },
});
// Burger menu is non-modal (gameplay stays visible; Play still works). Modals darken the shell.
// Dismiss burger + modals when the player hits Play:
betUi.bind({ onDismissOverlays: () => { gameMenu.close(); modalHost.close(); }, /* … */ });
```

Default pop-up items: **How to Play**, **Paytable**, **Stats**, **Recent Results**, **Music** (mute icon + volume slider), **Sound effects** (mute icon + volume slider). Tap outside or the burger again to dismiss. Register modal content per game in `js/menu.js`.

The **Paytable** burger label and default modal title resolve from copy policy: `paytableMenuLabel` / `paytableTitle` (real money: **Paytable**; social: **Win table**). Call `gameMenu.refresh()` after jurisdiction changes so labels update.

### Social modal copy

Stake.us-style social casinos require different terminology (**Bet → Play**, **Win → Earn**) and must avoid standalone **buy**, **bet**, and **pay** in player-facing strings. Preview with `?dev=true&social=true`.

**Engine helpers** (`client/suki/copy.js`, exported from `client/rgs.js`):

- `isSocialCasino(game)` — reads `game.copy.socialCasino`
- `pickSocialCopy(game, realText, socialText)` — dual string sets for modal bodies
- `game.t('paytableTitle')`, `game.t('paytableMenuLabel')`, `game.t('roundingNote')` — locale + social overrides in `client/suki/strings/en.js` / `enSocial`

**Pattern for game-specific rules** (How to Play, paytable footnotes) in `js/menu.js`:

```js
import { pickSocialCopy } from '@kap-solo/suki-engine/client/rgs.js';

const intro = pickSocialCopy(
  game,
  `Choose a ${t('bet').toLowerCase()} and press Spin.`,
  `Choose your ${t('betAmount').toLowerCase()} and press Spin.`,
);
```

Keep **game-specific** sentences in the title's `menu.js`; keep **shared labels** in engine string packs. English-only social copy is acceptable for initial Stake.us submission.

```js
const audioPrefs = createAudioPrefs({ storageKey: `${gameId}.audio` });
const gameAudio = createGameAudio({ audioPrefs });
gameAudio.setAssets({ music: 'assets/audio/music.mp3', sfx: { play: 'assets/audio/play.mp3' } });
gameAudio.playSfx('play');
```

Template: see `js/audio.js` and `assets/audio/README.md`.

## Stake screen preview (dev)

In `?dev=true`, wire the official Stake Engine iframe sizes via `createGameBootstrap`:

```js
const game = createGameBootstrap({
  shell: {
    screenPreview: { root: document.querySelector('.suki-stake-shell') },
    // optional: extraScreens: [{ id: 'custom', label: 'My tablet', width: 768, height: 1024 }],
  },
  // ...
});
```

Default screens (also `?screen=desktop` etc.):

| ID | Label | Preview frame (CSS px) | Stake Engine physical |
|----|-------|------------------------|------------------------|
| `desktop` | Desktop | 1200 × 675 | same |
| `laptop` | Laptop | 1024 × 576 | same |
| `popout-l` | Popout L | 800 × 450 | same |
| `popout-s` | Popout S | 400 × 225 | same |
| `mobile-l` | Mobile L | 425 × 812 | 1275 × 2436 @3x |
| `mobile-m` | Mobile M | 375 × 667 | 1125 × 2001 @3x |
| `mobile-s` | Mobile S | 320 × 568 | 960 × 1704 @3x |

Add more with `extraScreens` or `createScreenRegistry([...])`. Toolbar is hidden in production and hosted demo.

## Stake RGS sandbox mode

Test against **real Stake RGS** (not local mock) with `?sandbox=true` and iframe params:

```
https://your-game.example/?sandbox=true&rgs_url=rgs.stake-engine.com&sessionID=<from-stake>&lang=en
```

| Mode | URL | RGS target |
|------|-----|------------|
| development | `?dev=true` | local mock (same origin) |
| sandbox | `?sandbox=true` + `rgs_url` + `sessionID` | remote Stake RGS |
| production | Stake iframe params only | remote Stake RGS (no dev UI) |

`rgs_url` is **host-only** (Stake convention) — Suki normalizes to `https://`.

### CLI sandbox smoke

```bash
# Dry-run: authenticate + balance only
SUKI_RGS_URL=rgs.stake-engine.com \
SUKI_SESSION_ID=your-session-id \
SUKI_GAME_ID=pure-plinko \
SUKI_RGS_DRY_RUN=1 \
npm run test:sandbox

# Full wallet flow (places a real bet on sandbox!)
npm run test:sandbox
```

Included in `npm run check` when sandbox env vars are set.

## ERR scenario harness

Test Stake error codes against mock RGS injection and client policy:

```bash
npm run test:errors
```

Dev games can trigger mock errors with `_mock` on wallet requests (see `server/mock-rgs/inject-error.mjs`):

```js
// ?dev=true only — ignored in production Stake RGS
await authenticate(); // body includes getMockFlags() from URL
// Or in harness: { _mock: { play_error: 'ERR_UE' } }
```

## Compliance checklist & report

```bash
npm run check
npm run check -- --math ../Pure-Plinko/data
npm run check -- --math ../Pure-Plinko/data --out=./compliance-report.md
```

Runs smoke + ERR scenarios (+ optional sandbox + math validation), then prints a **one-page compliance report** suitable for a Stake provider outline: test results, RGS contract checklist, jurisdiction coverage, readiness estimates, and remaining gaps.

With live sandbox credentials:

```bash
SUKI_RGS_URL=rgs.stake-engine.com SUKI_SESSION_ID=... SUKI_GAME_ID=pure-plinko npm run check
```

## Reference game

[Pure Plinko](https://github.com/kap-solo/pure-plinko) is the first consumer.

## Deploying games (Render / CI)

Local development uses a sibling folder:

```json
"@kap-solo/suki-engine": "file:../Suki-Engine"
```

Games depend on Suki via GitHub (Render / CI). **Pin to a commit hash** so deploys do not drift when `main` moves:

```json
"@kap-solo/suki-engine": "github:kap-solo/suki-engine#dbc79c8"
```

Bump deliberately after engine changes: edit the hash in `package.json`, run `npm install`, commit `package.json` + `package-lock.json`, and smoke-test the game.

**Render / CI:** lockfile `resolved` must use `git+https://github.com/...`, not `git+ssh://` (no SSH keys on the host). `render.yaml` rewrites SSH→HTTPS before `npm ci`.

Use `#main` only for active engine development (not production deploys).

**Local engine development** — link the sibling folder instead of re-installing from GitHub:

```bash
cd Suki-Engine && npm link
cd ../Pure-Plinko && npm link @kap-solo/suki-engine
```

CI runs `npm run test:smoke` on every push to `main`.

## Not included

- Pixi / Svelte (use Stake web-sdk for slots)
- Math ACP publish pipeline
- Production Stake RGS credentials
