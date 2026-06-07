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
    lifecycle.js    — play → book events → end-round

harness/
  smoke.mjs         — compliance smoke tests

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

3. Call `initSuki({ gameId, replayVersion, sessionStorageKey })` before any RGS calls.
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
