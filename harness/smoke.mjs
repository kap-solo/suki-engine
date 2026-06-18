/**
 * Suki Engine compliance smoke tests.
 *
 * Unit (default): in-process mock RGS — no server required.
 * Integration: set SUKI_SMOKE_URL=http://127.0.0.1:5174 to hit a live game host.
 *
 * Usage: node harness/smoke.mjs
 */

import { createMockRgs } from '../server/mock-rgs/create-mock-rgs.mjs';
import { classifyRgsError } from '../client/suki/errors.js';
import { withRgsCall } from '../client/suki/rgsTransport.js';
import {
  isConnectionFailure,
  notifyRgsConnectionLost,
  notifyRgsConnectionRestored,
  setRgsConnectionCallbacks,
} from '../client/suki/rgsConnection.js';
import {
  buildRgsConfig,
  normalizeRgsBase,
  validateRgsConfig,
  isLocalRgsUrl,
} from '../client/suki/rgsConfig.js';
import { createGameBootstrap } from '../client/suki/gameBootstrap.js';
import { createAssetLoader, preloadAssets } from '../client/suki/assetLoader.js';
import { STAKE_SCREENS, createScreenRegistry } from '../client/suki/stakeScreens.js';
import {
  STAKE_LAYOUT_REF,
  STAKE_CORE_ASPECT,
  applyStakeScreenContext,
  resolveOrientation,
  resolvePortraitFamily,
} from '../client/suki/stakeLayout.js';
import { createBetUi, modeButtonLabel, resolvePlayButtonState } from '../client/suki/betUi.js';
import { createAudioPrefs } from '../client/suki/audioPrefs.js';
import { createRecentResultsStore } from '../client/suki/recentResults.js';
import { DEFAULT_GAME_MENU_ITEMS, filterVisibleMenuItems } from '../client/suki/gameMenu.js';
import { formatSessionElapsed, createSessionTimer } from '../client/suki/sessionTimer.js';
import { formatShellClockTime } from '../client/suki/shellClock.js';
import { formatCurrencyAmount, createCurrencyFormatter } from '../client/suki/currency.js';
import { createCopyPolicy, applyCopyLabels } from '../client/suki/copy.js';
import { shouldSkipBetEventReporting } from '../client/suki/roundReporting.js';
import { formatReplayStartSummary } from '../client/suki/replayUi.js';
import { createBookPlayer } from '../client/suki/bookPlayer.js';
import {
  createFatalRgsError,
  isFatalRgsError,
  shouldTreatAuthFailureAsInvalidRgs,
} from '../client/suki/rgsGate.js';
import { setPlayerCurrency, getPlayerCurrency } from '../client/suki/playerCurrency.js';
import { parseAuthResponse } from '../client/suki/authConfig.js';
import { createI18n, resolveLang } from '../client/suki/i18n.js';
import {
  createBetModePolicy,
  normalizeModeKey,
  toRgsMode,
  parseGameModesFromIndex,
} from '../client/suki/betModes.js';
import { createControlPolicy } from '../client/suki/controlPolicy.js';
import { createJurisdictionController } from '../client/suki/jurisdiction.js';

const API = 1_000_000;
const SAMPLE_STATE = [
  { index: 0, type: 'plinkoDrop', bucket: 3, path: [1, -1, 1], rows: 17 },
  { index: 1, type: 'setTotalWin', amount: 110 },
  { index: 2, type: 'finalWin', amount: 110 },
];

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function createHarnessRgs() {
  return createMockRgs({
    gameId: 'smoke-test',
    replayVersion: '1',
    resolvePlay(_session, body) {
      const amount = Number(body.amount);
      return {
        payout: Math.round(amount * 1.1),
        payoutMultiplier: 1.1,
        state: SAMPLE_STATE,
      };
    },
    resolveReplay(event, amountQuery) {
      if (event !== 'book-1') return null;
      const amountApi = Number(amountQuery) || API;
      return {
        round: {
          amount: amountApi,
          payout: Math.round(amountApi * 1.1),
          payoutMultiplier: 1.1,
          active: false,
          mode: 'BASE',
          state: SAMPLE_STATE,
        },
      };
    },
  });
}

function runUnitTests() {
  console.log('\nUnit — mock RGS');
  const rgs = createHarnessRgs();
  const sessionID = `smoke-${Date.now()}`;

  const auth = rgs.handleRgsRequest('/wallet/authenticate', {
    sessionID,
    gameID: 'smoke-test',
    language: 'en',
  });
  assert(!auth.error, 'authenticate succeeds');
  assert(auth.balance?.amount === 1000 * API, 'starting balance $1000');

  const play = rgs.handleRgsRequest('/wallet/play', {
    sessionID,
    gameID: 'smoke-test',
    amount: API,
    mode: 'BASE',
  });
  assert(!play.error, 'play succeeds');
  assert(play.round?.state?.length === 3, 'round has 3 book events');
  assert(play.round?.active === true, 'round is active');

  const ev0 = rgs.handleBetEvent({ sessionID, gameID: 'smoke-test', event: '0' });
  assert(ev0.event === '0', 'bet/event 0 recorded');

  const ev1 = rgs.handleBetEvent({ sessionID, gameID: 'smoke-test', event: '1' });
  assert(ev1.event === '1', 'bet/event 1 recorded');

  const action = rgs.handleBetAction({ sessionID, gameID: 'smoke-test', action: 'PICK_0' });
  assert(!action.error, 'bet/action on active round');
  assert(action.action?.active === true, 'bet/action returns active round');

  const badAction = rgs.handleBetAction({ sessionID: 'no-round', gameID: 'smoke-test', action: 'PICK_0' });
  assert(badAction.error?.code === 'ERR_VAL', 'bet/action rejected without active round');

  const end = rgs.handleRgsRequest('/wallet/end-round', { sessionID, gameID: 'smoke-test' });
  assert(!end.error, 'end-round succeeds');
  assert(end.replayEvent, 'replay event id returned');
  assert(end.balance.amount > play.balance.amount, 'balance credited after win');

  const authResume = rgs.handleRgsRequest('/wallet/authenticate', {
    sessionID,
    gameID: 'smoke-test',
    language: 'en',
  });
  assert(authResume.round?.active === false, 'no active round after end');

  const broke = rgs.handleRgsRequest('/wallet/play', {
    sessionID,
    gameID: 'smoke-test',
    amount: 999999 * API,
    mode: 'BASE',
  });
  assert(broke.error?.code === 'ERR_IPB', 'ERR_IPB on insufficient balance');

  const replay = rgs.handleReplayRequest('smoke-test', '1', 'base', 'book-1', String(API));
  assert(!replay.error, 'static replay resolves');
  assert(replay.round?.state?.length === 3, 'replay round has events');

  const strict = rgs.handleRgsRequest('/wallet/authenticate', {
    sessionID: 'strict-test',
    gameID: 'smoke-test',
    _mock: { jurisdiction: 'strict' },
  });
  assert(strict.config?.jurisdiction?.disabledAutoplay === true, 'strict jurisdiction mock');
  assert(strict.config?.jurisdiction?.displaySessionTimer === true, 'strict session timer');

  const eurAuth = rgs.handleRgsRequest('/wallet/authenticate', {
    sessionID: 'eur-test',
    gameID: 'smoke-test',
    _mock: { currency: 'EUR' },
  });
  assert(eurAuth.balance?.currency === 'EUR', 'mock auth returns EUR from _mock.currency');
}

async function post(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function runIntegrationTests(baseUrl) {
  const gameID = process.env.SUKI_INTEGRATION_GAME_ID || 'pure-plinko';
  const eventType = process.env.SUKI_INTEGRATION_EVENT_TYPE || 'plinkoDrop';

  console.log(`\nIntegration — ${baseUrl} (${gameID})`);
  const sessionID = `live-${Date.now()}`;
  const base = baseUrl.replace(/\/$/, '');

  const auth = await post(base, '/wallet/authenticate', {
    sessionID,
    gameID,
    language: 'en',
  });
  assert(!auth.error, 'authenticate');
  assert(auth.config?.gameID === gameID, 'game id');

  const play = await post(base, '/wallet/play', {
    sessionID,
    gameID,
    amount: API,
    mode: 'BASE',
  });
  assert(!play.error, 'play');
  assert(play.round?.state?.some((e) => e.type === eventType), `${eventType} in state`);

  const end = await post(base, '/wallet/end-round', { sessionID, gameID });
  assert(!end.error, 'end-round');

  const replayRes = await fetch(`${base}/bet/replay/${gameID}/1/base/1?amount=${API}`);
  const replay = await replayRes.json();
  assert(!replay.error, 'book replay GET');
}

function runRgsConfigTests() {
  console.log('\nUnit — RGS config');
  assert(normalizeRgsBase('rgs.stake-engine.com') === 'https://rgs.stake-engine.com', 'host-only rgs_url');
  assert(normalizeRgsBase('https://rgs.example.com/') === 'https://rgs.example.com', 'trim trailing slash');
  assert(isLocalRgsUrl('http://127.0.0.1:5174'), 'detect local RGS');
  assert(!isLocalRgsUrl('https://rgs.stake-engine.com'), 'remote RGS not local');

  const prodCfg = buildRgsConfig({
    gameId: 'pure-plinko',
    origin: 'http://127.0.0.1:5174',
    searchParams: new URLSearchParams('rgs_url=rgs.stake-engine.com&sessionID=abc'),
  });
  const prodVal = validateRgsConfig(prodCfg, 'production');
  assert(prodVal.ok, 'production valid with rgs_url + sessionID');

  const badProd = validateRgsConfig(
    buildRgsConfig({
      gameId: 'pure-plinko',
      origin: 'http://127.0.0.1:5174',
      searchParams: new URLSearchParams(''),
    }),
    'production',
  );
  assert(!badProd.ok, 'production rejects missing rgs_url');

  const badHost = validateRgsConfig(
    buildRgsConfig({
      gameId: 'pure-plinko',
      origin: 'http://127.0.0.1:5174',
      searchParams: new URLSearchParams('rgs_url=://bad&sessionID=abc'),
    }),
    'production',
  );
  assert(!badHost.ok, 'production rejects malformed rgs_url');

  assert(
    shouldTreatAuthFailureAsInvalidRgs('ERR_NET', 'production', { rgsUrlExplicit: true }),
    'ERR_NET with explicit rgs_url is fatal in production',
  );
  assert(
    !shouldTreatAuthFailureAsInvalidRgs('ERR_NET', 'development', { rgsUrlExplicit: true }),
    'ERR_NET in development is not treated as invalid launch config',
  );
  assert(
    shouldTreatAuthFailureAsInvalidRgs('HTTP_404', 'sandbox', { rgsUrlExplicit: true }),
    'HTTP errors with explicit rgs_url are fatal in sandbox',
  );

  const fatal = createFatalRgsError('Invalid connection settings.');
  assert(isFatalRgsError(fatal), 'createFatalRgsError is fatal');

  const sandboxVal = validateRgsConfig(prodCfg, 'sandbox');
  assert(sandboxVal.ok, 'sandbox accepts remote RGS');

  const demoCfg = buildRgsConfig({
    gameId: 'pure-plinko',
    origin: 'https://pure-plinko.onrender.com',
    searchParams: new URLSearchParams(''),
  });
  const demoVal = validateRgsConfig(demoCfg, 'hostedDemo');
  assert(demoVal.ok, 'hosted demo accepts same-origin mock without Stake params');
}

function runBootstrapTests() {
  console.log('\nUnit — game bootstrap');
  assert(typeof createGameBootstrap === 'function', 'createGameBootstrap exported');
}

function runScreenPreviewTests() {
  console.log('\nUnit — Stake screen preview');
  assert(STAKE_SCREENS.length === 7, 'default seven Stake screens');
  assert(STAKE_SCREENS[0].id === 'desktop' && STAKE_SCREENS[0].width === 1200, 'desktop screen');
  assert(STAKE_SCREENS[4].width === 425 && STAKE_SCREENS[4].stakeWidth === 1275, 'mobile L logical @3x');

  const registry = createScreenRegistry();
  assert(registry.get('popout-s')?.height === 225, 'resolve popout-s');
  assert(registry.resolveIdFromUrl('?screen=mobile-m') === 'mobile-m', 'parse screen URL param');
  assert(registry.resolveIdFromUrl('?screen=unknown') === null, 'ignore unknown screen');

  const extended = createScreenRegistry([
    { id: 'tablet-test', label: 'Tablet test', width: 768, height: 1024, orientation: 'portrait' },
  ]);
  assert(extended.screens.length === 8, 'append extra screen');
  assert(extended.get('tablet-test')?.width === 768, 'extra screen by id');
}

function runStakeLayoutTests() {
  console.log('\nUnit — Stake layout shell');
  assert(STAKE_LAYOUT_REF.width === 425 && STAKE_LAYOUT_REF.height === 812, 'Mobile L layout reference');
  assert(Math.abs(STAKE_CORE_ASPECT - 425 / 812) < 0.0001, 'core aspect from Mobile L');

  const desktop = STAKE_SCREENS[0];
  const mobileM = STAKE_SCREENS[5];
  const mobileL = STAKE_SCREENS[4];

  assert(resolveOrientation(desktop, 1200, 675) === 'landscape', 'desktop is landscape');
  assert(resolveOrientation(mobileM, 375, 667) === 'portrait', 'mobile M is portrait');
  assert(resolvePortraitFamily(mobileL, 425, 812) === 'mobile-l', 'mobile L portrait family');
  assert(resolvePortraitFamily(mobileM, 375, 667) === 'mobile-ms', 'mobile M uses M/S family');
  assert(resolvePortraitFamily(STAKE_SCREENS[6], 320, 568) === 'mobile-ms', 'mobile S uses M/S family');
  assert(resolvePortraitFamily(null, 425, 812) === 'mobile-l', 'infer tall portrait ratio');
  assert(resolvePortraitFamily(null, 375, 667) === 'mobile-ms', 'infer standard portrait ratio');
  assert(resolvePortraitFamily(desktop, 1200, 675) === '', 'landscape has no portrait family');

  const root = {
    dataset: {},
    style: { setProperty() {} },
    getBoundingClientRect: () => ({ width: 375, height: 667 }),
  };
  applyStakeScreenContext(root, { screen: mobileM });
  assert(root.dataset.sukiOrientation === 'portrait', 'apply portrait orientation');
  assert(root.dataset.sukiPortraitFamily === 'mobile-ms', 'apply M/S family');
  assert(root.dataset.sukiScreen === 'mobile-m', 'apply screen id');
}

function runBetUiTests() {
  console.log('\nUnit — bet UI');
  assert(typeof createBetUi === 'function', 'createBetUi exported');
  assert(
    resolvePlayButtonState({
      replayMode: false,
      busy: true,
      playing: true,
      autoplaying: false,
      rgsReady: true,
      canTurbo: true,
      playLabel: 'Drop',
    }).turbo,
    'turbo state while playing',
  );
  assert(
    resolvePlayButtonState({
      replayMode: false,
      busy: false,
      playing: false,
      autoplaying: false,
      rgsReady: true,
      canTurbo: true,
      playLabel: 'Play',
    }).label === 'Play',
    'idle play label',
  );
  assert(modeButtonLabel({ key: 'bonus', type: 'buy', costMultiplier: 100 }) === 'Buy bonus ×100', 'buy mode label');
}

function runGameMenuTests() {
  console.log('\nUnit — game menu & modals');
  assert(DEFAULT_GAME_MENU_ITEMS.length >= 6, 'default menu items');
  assert(DEFAULT_GAME_MENU_ITEMS.some((i) => i.id === 'paytable'), 'paytable menu item');
  assert(DEFAULT_GAME_MENU_ITEMS.some((i) => i.pref === 'music'), 'music toggle item');
  assert(DEFAULT_GAME_MENU_ITEMS.some((i) => i.type === 'volume'), 'music volume slider item');

  const prefs = createAudioPrefs({ storageKey: 'smoke.test.audio' });
  prefs.music.setEnabled(false);
  assert(prefs.music.enabled === false, 'music toggle off');
  prefs.sfx.setEnabled(true);
  assert(prefs.getState().sfx === true, 'sfx state');
  prefs.musicVolume.setValue(0.45);
  assert(prefs.musicVolume.value === 0.45, 'music volume set');
  prefs.musicVolume.setValue(1.5);
  assert(prefs.musicVolume.value === 1, 'music volume clamped high');
  prefs.musicVolume.setValue(-0.2);
  assert(prefs.musicVolume.value === 0, 'music volume clamped low');

  const recent = createRecentResultsStore({ max: 3 });
  recent.push({ data: { multiplier: 2 } });
  recent.push({ data: { multiplier: 5 } });
  assert(recent.length === 2, 'recent results push');
  recent.push({ data: { multiplier: 1 } });
  recent.push({ data: { multiplier: 9 } });
  assert(recent.length === 3, 'recent results max cap');

  const filtered = filterVisibleMenuItems(
    [
      { type: 'modal', id: 'stats', label: 'Stats', visible: () => false },
      { type: 'modal', id: 'paytable', label: 'Paytable' },
    ],
    null,
  );
  assert(filtered.length === 1 && filtered[0].id === 'paytable', 'filter visible menu items');
}

function runBetModeTests() {
  console.log('\nUnit — bet modes');

  assert(normalizeModeKey('BASE') === 'base', 'normalizeModeKey lowercases');
  assert(toRgsMode('bonus') === 'BONUS', 'toRgsMode uppercases');

  const fromIndex = parseGameModesFromIndex({
    modes: [{ name: 'base', cost: 1 }, { name: 'bonus', cost: 100 }],
  });
  assert(fromIndex.length === 2 && fromIndex[1].cost === 100, 'parseGameModesFromIndex');

  const jurisdiction = createJurisdictionController(() => {});
  jurisdiction.mergeFromServer({ disabledBuyFeature: false });
  const controls = createControlPolicy(jurisdiction);

  const policy = createBetModePolicy({
    gameModes: [
      { name: 'base', cost: 1 },
      { name: 'bonus', cost: 100 },
    ],
    authBetModes: {
      BASE: { mode: 'BASE', costMultiplier: 1, feature: false },
      BONUS: { mode: 'BONUS', costMultiplier: 100, feature: true },
    },
    controls,
  });

  assert(policy.modes.length === 2, 'catalog has base + bonus');
  assert(policy.playAmountApi(API) === API, 'base play amount');
  assert(policy.setActiveMode('bonus'), 'select bonus mode');
  assert(policy.playAmountApi(API) === 100 * API, 'bonus play amount = base × 100');
  assert(policy.rgsModeForPlay() === 'BONUS', 'RGS mode for bonus');
  assert(
    policy.baseBetApiFromPlayAmount(100 * API, 'BONUS') === API,
    'base bet recovered from bonus debit',
  );

  const blockedJurisdiction = createJurisdictionController(() => {});
  const blockedControls = createControlPolicy(blockedJurisdiction);
  const blockedPolicy = createBetModePolicy({
    gameModes: [
      { name: 'base', cost: 1 },
      { name: 'bonus', cost: 100 },
    ],
    authBetModes: {
      BONUS: { mode: 'BONUS', costMultiplier: 100, feature: true },
    },
    controls: blockedControls,
  });
  assert(!blockedPolicy.canSelectMode('bonus'), 'buy blocked when disabledBuyFeature');
  assert(blockedPolicy.setActiveMode('bonus') === false, 'setActiveMode rejects blocked buy');

  const rgs = createMockRgs({
    gameId: 'mode-smoke',
    replayVersion: '1',
    betConfig: {
      minBet: API,
      maxBet: 100 * API,
      stepBet: API,
      defaultBetLevel: API,
      betLevels: [API],
      betModes: {
        BASE: { mode: 'BASE', costMultiplier: 1, feature: false },
        BONUS: { mode: 'BONUS', costMultiplier: 100, feature: true },
      },
    },
    resolvePlay(_session, body) {
      return {
        payout: 0,
        payoutMultiplier: 0,
        state: SAMPLE_STATE,
        mode: body.mode,
      };
    },
    resolveReplay() {
      return null;
    },
  });

  const auth = rgs.handleRgsRequest('/wallet/authenticate', {
    sessionID: 'mode-smoke',
    gameID: 'mode-smoke',
  });
  assert(auth.config?.betModes?.BONUS?.costMultiplier === 100, 'mock auth exposes betModes');

  const bonusPlay = rgs.handleRgsRequest('/wallet/play', {
    sessionID: 'mode-smoke',
    gameID: 'mode-smoke',
    amount: 100 * API,
    mode: 'BONUS',
  });
  assert(!bonusPlay.error && bonusPlay.round?.mode === 'BONUS', 'mock play accepts BONUS mode');
}

function runCurrencyCopyTests() {
  console.log('\nUnit — currency & social copy');

  const usd = formatCurrencyAmount(12.5, 'USD', { locale: 'en' });
  assert(usd.includes('12.50'), 'USD format');

  const xgc = formatCurrencyAmount(100, 'XGC');
  assert(xgc === 'GC 100.00', 'XGC social currency label');

  const eur = createCurrencyFormatter({ currency: 'EUR', language: 'en' });
  assert(eur.format(1).includes('1.00'), 'EUR formatter');

  const real = createCopyPolicy({ socialCasino: false });
  const social = createCopyPolicy({ socialCasino: true });
  assert(real.term('balance') === 'Balance', 'real money balance label');
  assert(social.term('balance') === 'Coins', 'social casino balance label');
  assert(real.term('insufficientBalance') === 'Insufficient Funds.', 'exact insufficient funds copy');
  assert(social.term('insufficientBalance') === 'Insufficient Balance.', 'exact insufficient balance social');

  const summary = formatReplayStartSummary(
    real,
    { playAmount: 1, payoutMultiplier: 7, finalAmount: 7 },
    { formatCurrency: (n) => `$${n.toFixed(2)}`, formatMult: (n) => `${n}×` },
  );
  assert(summary.includes('Play cost'), 'replay intro play cost');
  assert(summary.includes('Payout multiplier'), 'replay intro payout multiplier');

  const socialSummary = formatReplayStartSummary(
    social,
    { playAmount: 1, payoutMultiplier: 7, finalAmount: 7 },
    { formatCurrency: (n) => `$${n.toFixed(2)}`, formatMult: (n) => `${n}×` },
  );
  assert(socialSummary.includes('Play amount'), 'social replay play amount label');
  assert(!socialSummary.toLowerCase().includes('cost'), 'social replay avoids cost');
  assert(social.term('baseBetLabel') === 'Base Play', 'stake.us base play label');
  assert(social.term('costMultiplierLabel') === 'Feature Multiplier', 'stake.us feature multiplier');
  assert(social.term('payoutMultiplierLabel') === 'Final multiplier', 'stake.us final multiplier');

  const label = { textContent: '' };
  applyCopyLabels(social, { balanceLabel: label });
  assert(label.textContent === 'Coins', 'applyCopyLabels updates HUD');

  setPlayerCurrency('EUR');
  assert(getPlayerCurrency('USD') === 'EUR', 'player currency after set');
  setPlayerCurrency(null);
  assert(getPlayerCurrency('GBP') === 'GBP', 'player currency falls back to URL');

  const parsed = parseAuthResponse({ balance: { amount: API, currency: 'CAD' } }, { urlCurrency: 'USD' });
  assert(parsed.currency === 'CAD', 'auth currency prefers balance over URL');
}

function runI18nTests() {
  console.log('\nUnit — i18n scaffold');

  assert(resolveLang('pt-BR') === 'en', 'unsupported locale falls back to en');
  assert(resolveLang('de') === 'de', 'German locale resolved');

  const enUi = createI18n({ lang: 'en', socialCasino: false });
  const deUi = createI18n({ lang: 'de', socialCasino: false });
  const enSocial = createI18n({ lang: 'en', socialCasino: true });

  assert(enUi.t('balance') === 'Balance', 'en balance');
  assert(deUi.t('balance') === 'Guthaben', 'de balance');
  assert(enSocial.t('balance') === 'Coins', 'en social balance');
  assert(deUi.t('setBetPrompt').includes('Drop'), 'de setBetPrompt');

  const custom = createI18n({ lang: 'en', overrides: { drop: 'Launch' } });
  assert(custom.t('drop') === 'Launch', 'per-game override');

  const interpolated = createI18n({ lang: 'en', overrides: { drop: 'Drop {n}' } });
  assert(interpolated.t('drop', { n: 3 }) === 'Drop 3', 'variable interpolation');
}

function runSessionTimerTests() {
  console.log('\nUnit — session timer');
  assert(formatSessionElapsed(0) === '00:00', 'zero elapsed');
  assert(formatSessionElapsed(65_000) === '01:05', 'minutes and seconds');
  assert(formatSessionElapsed(3_661_000) === '1:01:01', 'hours included');

  const el = { hidden: true, textContent: '' };
  const wrap = { hidden: true };
  let visible = false;
  const timer = createSessionTimer({
    element: el,
    container: wrap,
    getVisible: () => visible,
    tickMs: 60_000,
  });

  timer.sync();
  assert(el.hidden && wrap.hidden, 'hidden when jurisdiction off');

  visible = true;
  timer.sync();
  assert(!el.hidden && !wrap.hidden, 'visible when jurisdiction on');
  assert(el.textContent === '00:00', 'initial display');

  timer.reset();
  assert(timer.getElapsedMs() < 2000, 'reset restarts elapsed');

  timer.destroy();
}

function runShellClockTests() {
  console.log('\nUnit — shell clock');
  assert(formatShellClockTime(new Date(2026, 5, 7, 9, 5)) === '09:05', 'shell clock morning pad');
  assert(formatShellClockTime(new Date(2026, 5, 7, 14, 32)) === '14:32', 'shell clock 24h');
  assert(formatShellClockTime(new Date(2026, 5, 7, 0, 0)) === '00:00', 'shell clock midnight');
}

async function runPreloaderTests() {
  console.log('\nUnit — asset preloader');
  let lastProgress = -1;
  await preloadAssets([], (progress) => {
    lastProgress = progress;
  });
  assert(lastProgress === 100, 'empty preload reaches 100%');

  const loader = createAssetLoader({ assets: [] });
  let loaderProgress = -1;
  await loader.load((progress) => {
    loaderProgress = progress;
  });
  assert(loaderProgress === 100, 'createAssetLoader empty manifest');
}

async function runPolicyTests() {
  console.log('\nUnit — error policy & transport');
  assert(classifyRgsError('ERR_UE').retryable, 'ERR_UE is retryable');
  assert(classifyRgsError('ERR_NET').retryable, 'ERR_NET is retryable');
  assert(!classifyRgsError('ERR_IPB').retryable, 'ERR_IPB is not retryable');
  assert(classifyRgsError('ERR_BE').shouldResumeRound, 'ERR_BE resumes round');
  assert(isConnectionFailure('ERR_NET'), 'ERR_NET is connection failure');
  assert(isConnectionFailure('ERR_UE'), 'ERR_UE is connection failure');
  assert(!isConnectionFailure('ERR_IPB'), 'ERR_IPB is not connection failure');

  let lost = false;
  setRgsConnectionCallbacks({
    onLost: () => {
      lost = true;
    },
    onRestored: () => {
      lost = false;
    },
  });
  notifyRgsConnectionLost('ERR_NET');
  assert(lost, 'notifyRgsConnectionLost shows banner');
  notifyRgsConnectionRestored();
  assert(!lost, 'notifyRgsConnectionRestored hides banner');
  notifyRgsConnectionLost('ERR_IPB');
  assert(!lost, 'notifyRgsConnectionLost ignores non-connection errors');

  let attempts = 0;
  const value = await withRgsCall(async () => {
    attempts += 1;
    if (attempts < 2) throw new Error('ERR_GEN');
    return 'ok';
  }, { delayMs: 10 });
  assert(value === 'ok' && attempts === 2, 'withRgsCall retries then succeeds');
}

async function runComplianceReportingTests() {
  console.log('\nUnit — compliance reporting');

  assert(shouldSkipBetEventReporting({ payout: 0 }), 'skip bet/event when payout is 0');
  assert(!shouldSkipBetEventReporting({ payout: 1 }), 'report bet/event when payout > 0');
  assert(shouldSkipBetEventReporting({}), 'skip bet/event when payout missing');

  const reported = [];
  const player = createBookPlayer({
    handlers: { step: async () => {} },
    reportEvent: async (index) => {
      reported.push(index);
    },
  });
  await player.playEvents(
    [{ index: 0, type: 'step' }],
    { skipEventReporting: true },
    { skipReporting: false },
  );
  assert(reported.length === 0, 'book player respects skipEventReporting');
}

async function main() {
  console.log('Suki Engine — compliance smoke');
  runUnitTests();
  runRgsConfigTests();
  runBootstrapTests();
  runScreenPreviewTests();
  runStakeLayoutTests();
  runBetUiTests();
  runGameMenuTests();
  runBetModeTests();
  runCurrencyCopyTests();
  runI18nTests();
  await runComplianceReportingTests();
  runSessionTimerTests();
  runShellClockTests();
  await runPreloaderTests();
  await runPolicyTests();

  const url = process.env.SUKI_SMOKE_URL;
  if (process.env.SUKI_RUN_INTEGRATION === '1' && url) {
    try {
      await runIntegrationTests(url);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ integration failed: ${err.message}`);
    }
  } else {
    console.log('\n(skip integration — set SUKI_RUN_INTEGRATION=1 and SUKI_SMOKE_URL for live host)');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
