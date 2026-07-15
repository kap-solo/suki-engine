# Suki — local & deploy URL cheat sheet

Bookmark this file. Default local port is **5174** unless `PORT` is set.

---

## Pure Plinko

**Start:** `Pure-Plinko/start.bat` or `cd Pure-Plinko && npm start`

| Purpose | URL |
|---------|-----|
| Local dev (mock RGS + test buttons + **Stake screens** toolbar) | http://127.0.0.1:5174/?dev=true |
| Local hosted demo (playable, no dev UI) | http://127.0.0.1:5174/ |
| `start.bat` opens (mock RGS, no `dev=true`) | http://127.0.0.1:5174/?sessionID=local-demo&rgs_url=http://127.0.0.1:5174 |
| **Render — public demo** | https://pure-plinko.onrender.com/ |
| **Render — dev tools** | https://pure-plinko.onrender.com/?dev=true |

If port 5174 is busy, set another port then use that port in the URLs:

```bat
set PORT=5190
npm start
```

→ http://127.0.0.1:5190/?dev=true

---

## Template (`template/new-game`)

**Start:** `cd Suki-Engine/template/new-game && npm install && npm start`

| Purpose | URL |
|---------|-----|
| Local dev | http://127.0.0.1:5174/?dev=true |
| Strict jurisdiction (timer, buy blocked, etc.) | http://127.0.0.1:5174/?dev=true&jurisdiction=strict |
| Social casino copy preview | http://127.0.0.1:5174/?dev=true&social=true |
| Social GC currency | http://127.0.0.1:5174/?dev=true&social=true&currency=XGC |
| Social SC currency (Stake US) | http://127.0.0.1:5174/?dev=true&social=true&currency=XSC |
| Social SC currency (Stake EU / XEC) | http://127.0.0.1:5174/?dev=true&social=true&currency=XEC |
| German UI | http://127.0.0.1:5174/?dev=true&lang=de |

---

## URL modes (all Suki games)

| Query | Mode |
|-------|------|
| *(none)* on Render / public host | **Hosted demo** — mock RGS, no dev UI |
| `?dev=true` | **Development** — mock RGS, test buttons, compliance footer, **Stake screen toolbar** |
| `?sandbox=true&rgs_url=…&sessionID=…` | **Stake sandbox** — real remote RGS |
| Stake iframe params only | **Production** — live RGS, no dev UI |
| `?replay=true&event=…&amount=…` | **Replay** — recorded round |

---

## Stake screen preview (`?dev=true` only)

Add `&screen=<id>` to start in a fixed iframe size. Toolbar can switch without reloading.

Base: `http://127.0.0.1:5174/?dev=true`

Mobile rows use **CSS/logical** preview size (Stake physical ÷ 3). Landscape sizes are already CSS pixels.

| Screen | ID | Preview (CSS) | Stake physical | Example |
|--------|-----|---------------|----------------|---------|
| Desktop | `desktop` | 1200 × 675 | same | http://127.0.0.1:5174/?dev=true&screen=desktop |
| Laptop | `laptop` | 1024 × 576 | same | http://127.0.0.1:5174/?dev=true&screen=laptop |
| Popout L | `popout-l` | 800 × 450 | same | http://127.0.0.1:5174/?dev=true&screen=popout-l |
| Popout S | `popout-s` | 400 × 225 | same | http://127.0.0.1:5174/?dev=true&screen=popout-s |
| Mobile L | `mobile-l` | 425 × 812 | 1275 × 2436 @3x | http://127.0.0.1:5174/?dev=true&screen=mobile-l |
| Mobile M | `mobile-m` | 375 × 667 | 1125 × 2001 @3x | http://127.0.0.1:5174/?dev=true&screen=mobile-m |
| Mobile S | `mobile-s` | 320 × 568 | 960 × 1704 @3x | http://127.0.0.1:5174/?dev=true&screen=mobile-s |

Swap host/port for template or Render, e.g.:

https://pure-plinko.onrender.com/?dev=true&screen=popout-s

**Layout QA (template shell):** `mobile-l` (design reference) · `mobile-s` (M/S background + centered core) · `desktop` (landscape flanks) · `popout-s` (tight landscape — customize per game).

---

## Stake sandbox (when you have credentials)

Browser:

```
https://your-game.example/?sandbox=true&rgs_url=rgs.stake-engine.com&sessionID=<from-dashboard>&lang=en
```

CLI smoke (from Suki-Engine repo):

```bash
SUKI_RGS_URL=rgs.stake-engine.com SUKI_SESSION_ID=<id> SUKI_GAME_ID=pure-plinko npm run test:sandbox
```

---

## Repos

| Project | GitHub |
|---------|--------|
| Suki Engine | https://github.com/kap-solo/suki-engine |
| Pure Plinko | https://github.com/kap-solo/pure-plinko |

---

## Quick checks after deploy

| Check | URL |
|-------|-----|
| Page loads | https://pure-plinko.onrender.com/ |
| Suki vendor (should be **200**) | https://pure-plinko.onrender.com/vendor/suki-engine/client/suki/gameBootstrap.js |
