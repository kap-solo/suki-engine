# Stake Engine review feedback

Tracking items from Stake approval review. Fix in Suki Engine first, then bump Pure-Plinko pin.

## Pending

_(none)_

## Done

| Item | Implementation |
|------|----------------|
| **Bet amount field labeled “Bet amount”** | `applyCopyLabels()` maps `betLabel` → `betAmount` in `client/suki/copy.js` |
| Zero-win rounds skip `end-round` / bet/event | `roundReporting.js`, lifecycle, mock RGS |
| Insufficient balance — no `/wallet/play` | `balanceGuard.js`, bet UI disable |
| Autoplay confirmation modal | `autoplayConfirm.js` |
| All RGS calls use `rgs_url` launch param | `resolveRgsEndpoint`, per-request params |
| Main frame not scrollable | `stakeLayout.css`, `mobileTouch.js` |
| Dynamic authenticate bet params | `betConfig.js`, `authConfig.js`, `applyAuthBetConfig` |
| Active round → default bet from `round.amount` | `applyAuthRoundBetOverride`, `applyBetModeFromRound` |
| Invalid/changed `rgs_url` blocks load | `rgsGate.js`, `rgsLaunchLock.js`, preloader fatal state |
| Autoplay custom rounds = numeric input | `autoplayConfirm.js` |
| General Disclaimer in Game info | `gameInfo.js`, `appendGeneralDisclaimer`, Paytable modal |
| Win display full precision; balance 2 dp | `currency.js`, `formatWinAmount`, `game.formatWin()` |
| Social mode terminology (bet/pay/cost) | copy strings + sweep |
| Replay: lang param, start summary, button polish | `replayUi.js`, replay flow |
| Replay: persistent not-a-live-bet disclaimer | `replayUi.js`, `stakeLayout.css` banner |
| Game info: max mult + RTP per mode + rounding note | `gameInfo.js`, paytable modals |
| Stake.us labels: Base Play, Feature/Final Multiplier | social copy strings |
| **Social mode game mode naming (no buy/bet/pay in labels)** | `modeButtonLabel()` + `buyPlayButton` / `modeInfoBase` social copy; math `index.json` keys stay internal (`base`, `bonus`) |
