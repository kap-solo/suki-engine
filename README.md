# Suki Engine

Minimal, Stake-shaped game shell for custom browser games.

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

1. Copy `template/new-game/` into your game repo.
2. Add to `package.json`:

   ```json
   {
     "dependencies": {
       "@kap-solo/suki-engine": "file:../Suki-Engine"
     }
   }
   ```

3. Wire the shell with `createGameBootstrap()` (calls `initSuki` internally).
4. Implement `createMockRgs({ resolvePlay, resolveReplay })` for your math bundle.
5. Add an import map in `index.html`:

   ```html
   <script type="importmap">
   {
     "imports": {
       "@kap-solo/suki-engine/": "/vendor/suki-engine/"
     }
   }
   </script>
   ```

6. `npm install && node server.mjs`
7. `npm run test:smoke` in Suki-Engine (unit tests; add `SUKI_SMOKE_URL` for live host)
8. `npm run validate-math ./data` — verify math bundle before shipping

## Tier 2 APIs

- `createGameBootstrap(options)` — initSuki + production shell + jurisdiction + lifecycle + RGS start
- `createSessionTimer({ element, container, controls })` — elapsed session clock when `displaySessionTimer` is true
- `createCurrencyFormatter({ currency, language })` — Intl + social codes (XGC → GC, XSC → SC); set from auth via `game.formatCurrency()`
- `getPlayerCurrency()` / `setPlayerCurrency()` — URL `?currency=` before auth, `balance.currency` after authenticate; `play()` uses automatically
- `createI18n({ lang, socialCasino })` / `game.t('balance')` — locale strings from `lang` param; add locales in `client/suki/strings/`

### Adding a locale

1. Copy `client/suki/strings/en.js` → `fr.js` (translate `fr` + optional `frSocial`).
2. Register in `strings/index.js` (`PACKS` + `SUPPORTED_LOCALES`).
3. Stake passes `?lang=fr` — `createGameBootstrap` picks it up automatically.

Preview German locally: `?dev=true&lang=de`
- `createCopyPolicy({ socialCasino })` — Balance/Coins, Bet/Play, etc.; preview with `?dev=true&social=true`
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

## Compliance checklist

```bash
npm run check
npm run check -- --math ../Pure-Plinko/data
```

## Reference game

[Pure Plinko](https://github.com/kap-solo/pure-plinko) is the first consumer.

## Deploying games (Render / CI)

Local development uses a sibling folder:

```json
"@kap-solo/suki-engine": "file:../Suki-Engine"
```

Games depend on Suki via GitHub (Render / CI):

```json
"@kap-solo/suki-engine": "github:kap-solo/suki-engine#main"
```

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
