# Stake prelaunch checklist

Pre-submission checklist for Stake Engine game approval. Use before opening an approval request.

**Primary game focus:** slot titles (e.g. Basic-Slot). Instant/plinko patterns still apply where noted.

**How to use**

| Owner | Responsibility |
|-------|----------------|
| **Engine** | Fix once in `@kap-solo/suki-engine`, then bump the game pin |
| **Game** | Per-title copy, paytable, art, math bundle, modal content |
| **QA / Ops** | Manual device tests, sandbox session, ACP/dashboard, Slack channels |

**Status key**

| Symbol | Meaning |
|--------|---------|
| ✅ | Engine support in place (game may still need wiring or copy) |
| ⚠️ | Partial — verify per title or known gap |
| ❌ | Not implemented or not applicable without game work |
| 🔧 | Game-specific content or QA only |
| 📋 | Stake ops / manual sign-off |

Mark items `[x]` when verified for the **specific title** being submitted.

**Automated checks (engine)**

```bash
cd Suki-Engine
npm run test:smoke          # 231 unit checks (RGS, bet config, copy, replay, …)
npm run test:errors         # ERR scenario matrix
npm run check -- --math ../Basic-Slot/data   # swap path for your game data dir
npm run math:publish -- ../Basic-Slot-Pool/data   # Stake ACP upload folder
npm run validate-math -- --stake ../Basic-Slot-Pool/data/publish
npm run frontend:publish -- ../Basic-Slot-Pool   # Stake ACP frontend folder

# Live sandbox (requires Stake credentials)
SUKI_RGS_URL=rgs.stake-engine.com SUKI_SESSION_ID=<id> SUKI_GAME_ID=<game-id> npm run test:sandbox
```

**Dev preview URLs**

| Purpose | URL |
|---------|-----|
| Local dev | `?dev=true` |
| Social copy (Stake.US) | `?dev=true&social=true` |
| GC currency | `?dev=true&social=true&currency=XGC` |
| SC currency (Stake US) | `?dev=true&social=true&currency=XSC` |
| SC currency (Stake EU / XEC) | `?dev=true&social=true&currency=XEC` |
| Screen sizes | `?dev=true&screen=desktop` · `popout-s` · `mobile-l` · `mobile-s` |
| Strict jurisdiction | `?dev=true&jurisdiction=strict` |

See also [`DEV-URLS.md`](DEV-URLS.md) and [`STAKE-REVIEW-FEEDBACK.md`](STAKE-REVIEW-FEEDBACK.md) for implemented engine items.

---

## 1. RGS & wallet

| Done | Item | Owner | Engine | Notes |
|:----:|------|-------|--------|-------|
| [ ] | Game authenticates with RGS successfully on launch | Engine + Game | ✅ | Preloader → `authenticate()`; fatal gate on invalid launch config |
| [ ] | Bet button sends successful `/wallet/play` | Engine + Game | ✅ | `createSukiLifecycle().executeDrop()` |
| [ ] | Auth params used dynamically: `minBet`, `maxBet`, `stepBet`, `defaultBetLevel`, `betLevels` | Engine + Game | ✅ | `parseAuthResponse`, `applyAuthBetConfig` — game must call in `onConfigured` |
| [ ] | Active round in auth → default bet from `round.amount` | Engine + Game | ✅ | `applyAuthRoundBetOverride`, `applyBetModeFromRound` |
| [ ] | Zero-win round does **not** call `/wallet/end-round` | Engine | ✅ | `shouldSkipEndRound()` |
| [ ] | Insufficient balance does **not** call `/wallet/play` | Engine + Game | ✅ | `balanceGuard.js` + disabled play button |
| [ ] | All RGS calls use launch `rgs_url` (change URL → calls follow) | Engine | ✅ | `resolveRgsEndpoint`; smoke tests host A vs B |
| [ ] | Changed `rgs_url` after launch blocked in prod/sandbox | Engine | ✅ | `rgsLaunchLock.js`, preloader fatal state |
| [ ] | Live sandbox smoke pass | QA | 📋 | Set `SUKI_RGS_URL`, `SUKI_SESSION_ID`, `SUKI_GAME_ID` |

---

## 2. Currency

| Done | Item | Owner | Engine | Notes |
|:----:|------|-------|--------|-------|
| [ ] | Each enabled currency displays correctly (symbol or code: USD, EUR, ARS, CAD, …) | Game + QA | ⚠️ | Fiat via `Intl.NumberFormat`; test each currency Stake enables for the title |
| [ ] | Social GC / SC / XEC display without `$` prefix | Engine + QA | ✅ | `XGC` → GC, `XSC`/`XEC` → SC in `currency.js`; optional `balance.currencyDisplay` fallback |
| [ ] | Sub-cent payouts shown with full RGS precision | Engine + Game | ✅ | `formatWinAmount()` up to 6 dp; balance 2 dp |
| [ ] | Win display matches RGS settlement amount | Game + QA | 🔧 | Use `game.formatWin()` for payouts, not rounded balance formatter |

---

## 3. Frontend & shell

| Done | Item | Owner | Engine | Notes |
|:----:|------|-------|--------|-------|
| [ ] | Main game frame is not scrollable | Engine | ✅ | `stakeLayout.css`, `mobileTouch.js` |
| [ ] | Double-tap zoom disabled on mobile | Engine | ✅ | Viewport meta + `touch-action: manipulation` |
| [ ] | Spacebar triggers bet/play when jurisdiction allows | Game | ⚠️ | Engine: `controls.canSpacebar`; **game must bind** `keydown` |
| [ ] | Desktop / laptop layout works | Game + QA | ⚠️ | Test `?screen=desktop`, `laptop` |
| [ ] | Popout L / Popout S works | Game + QA | ⚠️ | Test `?screen=popout-l`, `popout-s` — replay especially on popout-s |
| [ ] | Mobile L / M / S works | Game + QA | ⚠️ | Test `?screen=mobile-l`, `mobile-m`, `mobile-s` |
| [ ] | Canvas/board scales without clipping illegible UI | Game | 🔧 | **Slots:** reel grid, win popups, cluster highlights at all sizes |

---

## 4. Bet modes & autoplay

| Done | Item | Owner | Engine | Notes |
|:----:|------|-------|--------|-------|
| [ ] | Confirmation when switching to mode with **> 2×** cost | Engine | ❌ | **Gap:** `betUi.selectMode()` is one-click; need confirm modal before buy/ante |
| [ ] | Confirmation copy social-safe (no buy/bet on Stake.US) | Engine | ❌ | Blocked on modal above |
| [ ] | Mode cost visible (base × multiplier = play debit) | Engine | ✅ | `modeCostLine` hint in bet UI |
| [ ] | Autoplay requires confirmation (not one click) | Engine | ✅ | `autoplayConfirm.js` |
| [ ] | Autoplay custom rounds = numeric input only | Engine | ✅ | Strips non-digits, rejects 0 |

**Slots note:** Buy-bonus / feature modes almost always trigger the > 2× confirmation rule. Treat as **launch blocker** until engine modal ships.

---

## 5. Game rules & info

| Done | Item | Owner | Engine | Notes |
|:----:|------|-------|--------|-------|
| [ ] | RTP stated in game info | Game | 🔧 | Per mode if modes differ |
| [ ] | Max win stated in game info | Game | 🔧 | Per mode if modes differ |
| [ ] | Payout information per symbol clearly communicated | Game | 🔧 | **Slots:** paytable modal — symbol values, wild/scatter rules |
| [ ] | Win combinations documented (lines, clusters, scatter pays, etc.) | Game | 🔧 | **Slots:** cluster sizes, pay lines, scatter thresholds |
| [ ] | Description and **cost** for each available game mode | Game | 🔧 | Base vs feature/buy — debit formula in plain language |
| [ ] | Free games / bonus trigger conditions documented | Game | 🔧 | **Slots:** e.g. scatter count → spins awarded |
| [ ] | Re-trigger rules documented (if applicable) | Game | 🔧 | e.g. 2 scatters = +5 spins, 3 = +10 |
| [ ] | General Disclaimer in game info (exact Stake text) | Engine + Game | ✅ | `appendGeneralDisclaimer()` — wire into paytable/info modal |
| [ ] | Rounding note (balance 2 dp vs win full precision) | Engine + Game | ✅ | `roundingNote` string |
| [ ] | User interaction guide — **every** player-facing control explained | Game | ⚠️ | How to Play modal: play, turbo, chips, autoplay, menu, sound, mode switch |
| [ ] | No hit rate / probability / “1 in N” metrics shown to player | Game + QA | ✅ engine | Do not expose math stats in UI; review session stats copy |

**Slots starter:** extend `js/menu.js` paytable + how-to-play beyond engine template stubs before submission.

---

## 6. Sounds

| Done | Item | Owner | Engine | Notes |
|:----:|------|-------|--------|-------|
| [ ] | Option to disable sounds in UI | Engine + Game | ✅ | Burger menu: Music + SFX volume sliders (mute icon → 0) |
| [ ] | Game wires `createGameAudio` + assets | Game | 🔧 | **Slots:** spin, win, cascade, feature SFX |

---

## 7. Language

| Done | Item | Owner | Engine | Notes |
|:----:|------|-------|--------|-------|
| [ ] | English complete | Engine + Game | ✅ | `strings/en.js`, `enSocial` |
| [ ] | Invalid / unsupported `lang` falls back without broken UI | Engine | ✅ | `resolveLang()` → `en` |
| [ ] | Additional locales (if any) fully translated | Game | ⚠️ | `de` scaffold only — English-only submission is fine |

---

## 8. Stake.US / social casino

Preview: `?dev=true&social=true&currency=XGC`

| Done | Item | Owner | Engine | Notes |
|:----:|------|-------|--------|-------|
| [ ] | Bet button does not say “Bet” | Engine + Game | ✅ | Social: “Play” / “Drop” / feature labels |
| [ ] | Bet amount field not labeled “Bet amount” | Engine | ✅ | Social: “Play amount” via `applyCopyLabels` |
| [ ] | Autoplay not labeled “AutoBET”; popups avoid “bet” | Engine | ✅ | `autoplayButton`, confirm copy |
| [ ] | Bonus/feature label avoids “BUY” | Engine | ✅ | Social: “Feature ×N” |
| [ ] | Mode confirmation avoids “buy” and “bet” | Engine | ❌ | Depends on > 2× confirm modal |
| [ ] | Insufficient funds error uses allowed wording | Engine | ✅ | “Insufficient Balance.” (social) |
| [ ] | GC, SC, and XEC supported and displayed (no `$`) | Engine + QA | ✅ | `?currency=XGC` / `XSC` / `XEC` |
| [ ] | Mode naming in UI, replay, and player-facing strings avoids buy/bet/pay | Engine + Game | ⚠️ | Internal math keys (`base`, `bonus`) OK; sweep game-specific strings |
| [ ] | Replay UI free of restricted words | Engine + Game | ✅ | Recent replay disclaimer work |

---

## 9. Replay

| Done | Item | Owner | Engine | Notes |
|:----:|------|-------|--------|-------|
| [ ] | Replay URL loads and plays requested event | Engine + Game | ✅ | `getReplayParams`, `requestReplay` |
| [ ] | Optional params: `amount`, `lang`, `mode`, `event` | Engine | ✅ | `currency` via standard launch param if appended to URL |
| [ ] | “Replay again” at end of replay | Engine + Game | ✅ | Replay panel button |
| [ ] | UI shows play cost, multiplier, final payout | Engine + Game | ✅ | `formatReplayStartSummary()` |
| [ ] | Buy/feature replay shows **real debit** vs base (e.g. $1 base, $250 total) | Engine + Game | ⚠️ | Live play has `modeCostLine`; replay intro may need explicit “real cost” copy |
| [ ] | Clear “not a live bet” messaging | Engine | ✅ | Shell banner + disclaimer in summary |
| [ ] | Replay works in Popout S | Game + QA | 🔧 | Manual: `?replay=true&…&screen=popout-s` |
| [ ] | Provably fair + replay enabled in ACP | QA | 📋 | Stake dashboard config |

---

## 10. Manual QA (per title)

| Done | Item | Owner | Notes |
|:----:|------|-------|-------|
| [ ] | 10 wins **per game mode** match game rules payout | QA | Spot-check displayed win vs RGS `payout` / paytable |
| [ ] | Active-round resume after refresh mid-spin/feature | QA | Auth returns `round.active: true` |
| [ ] | Disconnect messaging / reload completes round | QA | Disclaimer covers this; verify resume path |
| [ ] | Older Android browsers | QA | 📋 Device matrix |
| [ ] | Older iOS / Safari | QA | 📋 Device matrix |
| [ ] | Bet-level templates applied in ACP | QA | 📋 Stake provider dashboard |
| [ ] | Front + Math requests **Approved** and **Active** | QA | 📋 |
| [ ] | Game listed in approval Slack channels (com / us / mx as applicable) | QA | 📋 |
| [ ] | Approval tickets closed after live “checked” emoji | QA | 📋 |

---

## Engine priority backlog (blocks multiple titles)

Fix in Suki Engine first, then bump game pins.

| Priority | Item | Status |
|----------|------|--------|
| P0 | Bet-mode confirmation modal when `costMultiplier > 2` | ❌ Not started |
| P1 | Social-safe confirm copy for feature modes | ❌ Blocked on P0 |
| P1 | Replay intro: explicit base vs total debit for buy modes | ⚠️ Partial |
| P2 | `buildReplayUrl()` include `currency` param | ⚠️ Manual append works |
| P2 | How-to-play template listing all shell controls | ⚠️ Stub in template |
| P3 | Complete `de` locale (only if targeting DE) | ⚠️ Scaffold |

---

## Per-game sign-off

Use one block per submitting title.

### Template — copy for each game

```markdown
### [Game name] — [game-id]

- [ ] Engine pin: `#________`
- [ ] Math bundle validated: `npm run check -- --math path/to/data`
- [ ] Stake publish folder built: `npm run math:publish -- path/to/data`
- [ ] Stake ACP rules pass: `npm run validate-math -- --stake path/to/data/publish`
- [ ] Frontend bundle built: `npm run frontend:publish -- path/to/game`
- [ ] Sandbox smoke pass
- [ ] Social preview pass (`?dev=true&social=true&currency=XGC`)
- [ ] All sections above checked for this title
- [ ] Approval request submitted: [link]
- [ ] Live on Stake: [date]
```

### Basic-Slot (slot — primary candidate)

- [ ] Engine pin: _current_
- [ ] Paytable: cluster sizes, symbol pays, scatter/bonus if any
- [ ] Game info: RTP, max win, mode costs, free-spin rules
- [ ] How to Play: all controls documented
- [ ] Cascade/feature book resume tested

### Pure-Plinko (instant — reference, not first ship)

- [ ] Bucket paytable + on-screen table
- [ ] Base mode only (no buy-confirm gap for this title)
- [ ] Spacebar wired

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-06 | Initial checklist from Stake approval requirements; slots as primary focus |
