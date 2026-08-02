/**
 * Suki Engine compliance smoke tests.
 *
 * Unit (default): in-process mock RGS — no server required.
 * Integration: set SUKI_SMOKE_URL=http://127.0.0.1:5174 to hit a live game host.
 *
 * Usage: node harness/smoke.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  formatRgsUrlParam,
  resolveRgsEndpoint,
} from '../client/suki/rgsConfig.js';
import { createGameBootstrap } from '../client/suki/gameBootstrap.js';
import { SUKI_VIEWPORT_CONTENT } from '../client/suki/mobileTouch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const engineRoot = join(__dirname, '..');
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
import { SPINE_SYMBOL_FIT_RATIO, SPINE_TEXTURE_CANVAS_SIZE } from '../client/suki/spineAssets.js';
import { createRecentResultsStore } from '../client/suki/recentResults.js';
import { DEFAULT_GAME_MENU_ITEMS, filterVisibleMenuItems, resolveGameMenuItems } from '../client/suki/gameMenu.js';
import { formatSessionElapsed, createSessionTimer } from '../client/suki/sessionTimer.js';
import { formatShellClockTime } from '../client/suki/shellClock.js';
import { formatCurrencyAmount, formatWinAmount, createCurrencyFormatter } from '../client/suki/currency.js';
import { createCopyPolicy, applyCopyLabels, pickSocialCopy, isSocialCasino } from '../client/suki/copy.js';
import { resolveSocialCasinoMode } from '../client/suki/devSocialMode.js';
import { shouldSkipBetEventReporting, shouldSkipEndRound } from '../client/suki/roundReporting.js';
import { canAffordPlayAmount, assertSufficientBalanceForPlay } from '../client/suki/balanceGuard.js';
import {
  registerAutoplayConfirm,
  AUTOPLAY_CONFIRM_MODAL_ID,
  parseAutoplayRoundCount,
  sanitizeAutoplayRoundDigits,
  shouldBlockAutoplayRoundKey,
} from '../client/suki/autoplayConfirm.js';
import { formatReplayStartSummary, applyReplayModeChrome, resolveReplayBaseBetDisplay, formatReplayPayoutMultiplier, replaySettlementMultiplier } from '../client/suki/replayUi.js';
import {
  detectReplayLaunch,
  normalizeStakeLaunchAliases,
  readLaunchEventId,
  readLaunchSearchParams,
} from '../client/suki/launchParams.js';
import { normalizeReplayRound, appendGeneralDisclaimer } from '../client/rgs.js';
import { createBookPlayer } from '../client/suki/bookPlayer.js';
import {
  createFatalRgsError,
  isFatalRgsError,
  shouldTreatAuthFailureAsInvalidRgs,
} from '../client/suki/rgsGate.js';
import {
  hasRgsUrlParamChanged,
  shouldEnforceLaunchRgsLock,
  validateLaunchRgsUrlStable,
} from '../client/suki/rgsLaunchLock.js';
import { setPlayerCurrency, getPlayerCurrency } from '../client/suki/playerCurrency.js';
import { parseAuthResponse } from '../client/suki/authConfig.js';
import {
  applyAuthBetConfig,
  applyAuthRoundBetOverride,
  buildBetLevelsApi,
  clampBetApi,
  createBetConfigPolicy,
  hasAuthBetConfig,
} from '../client/suki/betConfig.js';
import { createI18n, resolveLang } from '../client/suki/i18n.js';
import { en } from '../client/suki/strings/en.js';
import {
  createBetModePolicy,
  applyBetModeFromRound,
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
  assert(normalizeRgsBase('127.0.0.1:5174') === 'http://127.0.0.1:5174', 'host-only local rgs_url uses http');
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

  const cfgA = buildRgsConfig({
    gameId: 'pure-plinko',
    origin: 'https://game.example.com',
    searchParams: new URLSearchParams('rgs_url=rgs-a.stake-engine.com&sessionID=abc'),
  });
  const cfgB = buildRgsConfig({
    gameId: 'pure-plinko',
    origin: 'https://game.example.com',
    searchParams: new URLSearchParams('rgs_url=rgs-b.stake-engine.com&sessionID=abc'),
  });
  assert(cfgA.rgsUrl === 'https://rgs-a.stake-engine.com', 'rgs_url A resolves to remote host');
  assert(cfgB.rgsUrl === 'https://rgs-b.stake-engine.com', 'rgs_url B resolves to remote host');
  assert(cfgA.rgsUrl !== cfgB.rgsUrl, 'changing rgs_url changes RGS target');
  assert(!cfgA.rgsUrl.includes('game.example.com'), 'explicit rgs_url does not use page origin');

  const playA = resolveRgsEndpoint(cfgA.rgsUrl, '/wallet/play');
  const playB = resolveRgsEndpoint(cfgB.rgsUrl, '/wallet/play');
  assert(playA === 'https://rgs-a.stake-engine.com/wallet/play', 'wallet/play targets rgs_url A');
  assert(playB === 'https://rgs-b.stake-engine.com/wallet/play', 'wallet/play targets rgs_url B');

  const localHttp = buildRgsConfig({
    gameId: 'pure-plinko',
    origin: 'https://game.example.com',
    searchParams: new URLSearchParams('rgs_url=http://127.0.0.1:5174&sessionID=local'),
  });
  assert(localHttp.rgsUrl === 'http://127.0.0.1:5174', 'full http rgs_url preserved for local mock');
  assert(
    resolveRgsEndpoint(localHttp.rgsUrl, '/wallet/authenticate') === 'http://127.0.0.1:5174/wallet/authenticate',
    'local mock authenticate uses explicit rgs_url',
  );

  assert(formatRgsUrlParam('https://rgs.stake-engine.com') === 'rgs.stake-engine.com', 'replay param uses host-only');
  assert(cfgA.rgsUrlHost === 'rgs-a.stake-engine.com', 'rgsUrlHost matches Stake host-only param');

  assert(
    resolveRgsEndpoint(cfgA.rgsUrl, '/bet/event') === 'https://rgs-a.stake-engine.com/bet/event',
    'bet/event targets rgs_url from params',
  );
  assert(
    resolveRgsEndpoint(cfgB.rgsUrl, '/wallet/end-round') === 'https://rgs-b.stake-engine.com/wallet/end-round',
    'end-round targets changed rgs_url',
  );

  assert(
    hasRgsUrlParamChanged('rgs-a.stake-engine.com', 'rgs-b.stake-engine.com', 'https://game.example.com'),
    'detects changed rgs_url host',
  );
  assert(
    !hasRgsUrlParamChanged('rgs-a.stake-engine.com', 'rgs-a.stake-engine.com', 'https://game.example.com'),
    'unchanged rgs_url host',
  );
  assert(
    !hasRgsUrlParamChanged('', 'rgs-b.stake-engine.com', 'https://game.example.com'),
    'no launch rgs_url means no change lock',
  );
  assert(shouldEnforceLaunchRgsLock('production'), 'production locks launch rgs_url');
  assert(shouldEnforceLaunchRgsLock('sandbox'), 'sandbox locks launch rgs_url');
  assert(!shouldEnforceLaunchRgsLock('development'), 'local dev does not lock by default');
  assert(validateLaunchRgsUrlStable('hostedDemo').ok, 'hosted demo skips launch lock');
}

function runReplayLaunchTests() {
  console.log('\nUnit — replay launch params');

  const hashOnly = readLaunchSearchParams({
    search: '',
    hash: '#game=reflecting-pool&eventId=20&version=1&mode=bb&amount=10000000',
  });
  assert(hashOnly.get('eventId') === '20', 'hash params merge into launch params');
  assert(readLaunchEventId(hashOnly) === '20', 'eventId maps to replay event');

  const aliased = new URLSearchParams('eventId=20&language=de-DE');
  normalizeStakeLaunchAliases(aliased);
  assert(aliased.get('event') === '20', 'eventId alias promotes to event');
  assert(aliased.get('lang') === 'de', 'language alias promotes to lang');

  const previewer = new URLSearchParams(
    'game=reflecting-pool&eventId=20&version=1&mode=bb&amount=10000000',
  );
  assert(detectReplayLaunch(previewer), 'Stake previewer params detect replay without replay=true');

  const explicit = new URLSearchParams('replay=true&event=1&game=g&version=1');
  assert(detectReplayLaunch(explicit), 'replay=true still detects replay');

  const play = new URLSearchParams('sessionID=abc&rgs_url=rgs.example.com');
  assert(!detectReplayLaunch(play), 'normal launch is not replay');

  const launchParams = {
    mode: 'bb',
    event: '20',
    amountApi: 10_000_000,
  };
  const wrapped = normalizeReplayRound(
    { round: { amount: 10_000_000, mode: 'BB', state: [{ type: 'reveal' }], payout: 0 } },
    launchParams,
  );
  assert(wrapped.amount === 10_000_000, 'wrapped replay round keeps amount');

  const flat = normalizeReplayRound(
    { state: [{ type: 'reveal' }], payoutMultiplier: 2.5 },
    launchParams,
  );
  assert(flat.state.length === 1, 'flat replay payload normalizes state');
  assert(flat.amount === 10_000_000, 'flat replay uses launch amount');
  assert(flat.payout === 25_000_000, 'flat replay derives payout from multiplier');
  assert(flat.roundID === '20', 'flat replay uses launch event as round id');
  assert(typeof appendGeneralDisclaimer === 'function', 'rgs re-exports appendGeneralDisclaimer');

  const replayBet = resolveReplayBaseBetDisplay(
    { amount: 100_000_000, mode: 'BASE' },
    { baseBetApiFromPlayAmount: (amountApi) => amountApi },
  );
  assert(replayBet === 100, 'replay base bet preserves full launch amount');

  assert(
    formatReplayPayoutMultiplier({ amount: 100_000_000, payout: 4_068_000_000 }) === '40.68×',
    'replay payout mult reconciles with settled amounts',
  );
  assert(replaySettlementMultiplier({ amount: 100_000_000, payout: 4_068_000_000 }) === 40.68, 'replay settlement mult');
}

function runBootstrapTests() {
  console.log('\nUnit — game bootstrap');
  assert(typeof createGameBootstrap === 'function', 'createGameBootstrap exported');
  assert(SUKI_VIEWPORT_CONTENT.includes('user-scalable=no'), 'viewport disables user scaling');
  assert(SUKI_VIEWPORT_CONTENT.includes('maximum-scale=1'), 'viewport caps maximum scale');
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

  const layoutCss = readFileSync(join(engineRoot, 'client/suki/stakeLayout.css'), 'utf8');
  assert(/html,\s*body[\s\S]*overflow:\s*hidden/.test(layoutCss), 'document overflow hidden');
  assert(layoutCss.includes('.suki-stake-shell') && /\.suki-stake-shell[\s\S]*overflow:\s*hidden/.test(layoutCss), 'shell overflow hidden');
  assert(/\.suki-game-core[\s\S]*overflow:\s*hidden/.test(layoutCss), 'game core overflow hidden');
  assert(!layoutCss.includes('min-height: 100vh'), 'shell avoids 100vh min-height scroll trap');

  const touchJs = readFileSync(join(engineRoot, 'client/suki/mobileTouch.js'), 'utf8');
  assert(touchJs.includes("style.overflow = 'hidden'"), 'mobile touch policy locks document scroll');
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
  assert(modeButtonLabel({ key: 'bonus', type: 'buy', costMultiplier: 100 }) === 'Buy bonus ×100', 'buy mode label real money');
  assert(
    resolvePlayButtonState({
      replayMode: false,
      busy: false,
      playing: false,
      autoplaying: false,
      rgsReady: true,
      canTurbo: true,
      canAffordPlay: false,
      playLabel: 'Play',
    }).disabled,
    'play disabled when insufficient balance',
  );
}

function runAutoplayConfirmTests() {
  console.log('\nUnit — autoplay confirm');

  assert(sanitizeAutoplayRoundDigits('12abc!') === '12', 'autoplay input strips non-digits');
  assert(parseAutoplayRoundCount('25x') === 25, 'autoplay parses numeric rounds');
  assert(parseAutoplayRoundCount('abc', { fallback: null }) === null, 'autoplay rejects alphabetic input');
  assert(parseAutoplayRoundCount('0', { fallback: null }) === null, 'autoplay rejects zero rounds');
  assert(parseAutoplayRoundCount('1500') === 999, 'autoplay clamps to max rounds');
  assert(shouldBlockAutoplayRoundKey({ key: 'a' }), 'autoplay blocks alphabetic key');
  assert(!shouldBlockAutoplayRoundKey({ key: '5' }), 'autoplay allows digit key');
  assert(!shouldBlockAutoplayRoundKey({ key: 'Backspace' }), 'autoplay allows backspace');

  let confirmCalls = 0;
  let confirmedRounds = 0;
  const registry = new Map();

  const modalHost = {
    register(id, def) {
      registry.set(id, def);
    },
    open(id) {
      const def = registry.get(id);
      if (typeof document === 'undefined') return { body: null, startBtn: null, customInput: null };
      const body = document.createElement('div');
      def?.render?.(body);
      const startBtn = body.querySelector('.suki-autoplay-start');
      const customInput = body.querySelector('.suki-autoplay-rounds-input');
      return { body, startBtn, customInput };
    },
    close() {},
  };

  registerAutoplayConfirm(modalHost, {
    t: (key) => key,
    getPlayCost: () => 1,
    getBalance: () => 10,
    onConfirm: (rounds) => {
      confirmCalls += 1;
      confirmedRounds = rounds;
    },
  });

  assert(registry.has(AUTOPLAY_CONFIRM_MODAL_ID), 'autoplay confirm modal registered');
  assert(confirmCalls === 0, 'autoplay not started on register');

  if (typeof document === 'undefined') {
    console.log('  (skip DOM confirm flow — no document in harness)');
    return;
  }

  const opened = modalHost.open(AUTOPLAY_CONFIRM_MODAL_ID);
  assert(opened.body?.querySelector('.suki-autoplay-start'), 'autoplay confirm renders start button');
  assert(opened.customInput?.type === 'number', 'custom autoplay rounds uses numeric input');
  assert(confirmCalls === 0, 'autoplay not started when modal opens');

  opened.startBtn?.click();
  assert(confirmCalls === 1, 'autoplay starts only after confirm click');
  assert(confirmedRounds === 100, 'autoplay confirm passes default preset round count');

  const customOpen = modalHost.open(AUTOPLAY_CONFIRM_MODAL_ID);
  if (customOpen.customInput) {
    customOpen.customInput.value = '37abc';
    customOpen.customInput.dispatchEvent(new Event('input', { bubbles: true }));
    assert(customOpen.customInput.value === '37', 'custom input sanitized to digits only');
    customOpen.startBtn?.click();
    assert(confirmedRounds === 37, 'autoplay confirm uses sanitized custom round count');
  }
}

function runBalanceGuardTests() {
  console.log('\nUnit — balance guard');

  assert(canAffordPlayAmount(2 * API, API), 'afford when balance >= play cost');
  assert(!canAffordPlayAmount(API - 1, API), 'cannot afford when balance < play cost');
  assert(!canAffordPlayAmount(API, 0), 'cannot afford zero play amount');

  try {
    assertSufficientBalanceForPlay(API - 1, API);
    assert(false, 'assertSufficientBalanceForPlay throws ERR_IPB');
  } catch (err) {
    assert(String(err.message) === 'ERR_IPB', 'assertSufficientBalanceForPlay throws ERR_IPB');
  }
}

function runSpineAssetTests() {
  console.log('\nUnit — Spine asset conventions');
  assert(SPINE_TEXTURE_CANVAS_SIZE === 256, 'SPINE_TEXTURE_CANVAS_SIZE is 256');
  assert(SPINE_SYMBOL_FIT_RATIO > 0 && SPINE_SYMBOL_FIT_RATIO < 1, 'SPINE_SYMBOL_FIT_RATIO in (0, 1)');
  const spineReadme = readFileSync(join(engineRoot, 'template/new-game/assets/spine/README.md'), 'utf8');
  assert(spineReadme.includes('256×256'), 'template spine README documents 256 canvas');
}

function runGameMenuTests() {
  console.log('\nUnit — game menu & modals');
  assert(DEFAULT_GAME_MENU_ITEMS.length >= 6, 'default menu items');
  assert(DEFAULT_GAME_MENU_ITEMS.some((i) => i.id === 'paytable'), 'paytable menu item');
  assert(DEFAULT_GAME_MENU_ITEMS.some((i) => i.channel === 'music'), 'music volume item');
  assert(DEFAULT_GAME_MENU_ITEMS.some((i) => i.channel === 'sfx'), 'sfx volume item');

  const prefs = createAudioPrefs({ storageKey: 'smoke.test.audio' });
  prefs.musicVolume.setValue(0.45);
  assert(prefs.musicVolume.value === 0.45, 'music volume set');
  prefs.musicVolume.setValue(0);
  assert(prefs.music.enabled === false, 'music muted at zero volume');
  prefs.musicVolume.toggleMute();
  assert(prefs.musicVolume.value > 0, 'music mute icon restores volume');
  prefs.sfxVolume.setValue(0.33);
  assert(prefs.getState().sfxVolume === 0.33, 'sfx volume state');
  prefs.sfx.setEnabled(false);
  assert(prefs.sfxVolume.value === 0, 'sfx setEnabled false mutes');
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

  const real = createCopyPolicy({ socialCasino: false });
  const social = createCopyPolicy({ socialCasino: true });
  const realMenu = resolveGameMenuItems(DEFAULT_GAME_MENU_ITEMS, real);
  const socialMenu = resolveGameMenuItems(DEFAULT_GAME_MENU_ITEMS, social);
  const realPaytable = realMenu.find((i) => i.id === 'paytable');
  const socialPaytable = socialMenu.find((i) => i.id === 'paytable');
  assert(realPaytable?.label === 'Paytable', 'real money paytable menu label');
  assert(socialPaytable?.label === 'Win table', 'social paytable menu label');
  assert(!/\b(buy|bet|pay)\b/i.test(socialPaytable?.label ?? ''), 'social paytable menu avoids buy/bet/pay');

  assert(
    pickSocialCopy({ copy: { socialCasino: false } }, 'Choose a bet', 'Choose your play amount') === 'Choose a bet',
    'pickSocialCopy real money',
  );
  assert(
    pickSocialCopy({ copy: { socialCasino: true } }, 'Choose a bet', 'Choose your play amount') === 'Choose your play amount',
    'pickSocialCopy social',
  );
  assert(isSocialCasino({ copy: { socialCasino: true } }), 'isSocialCasino true');
  assert(!isSocialCasino({ copy: { socialCasino: false } }), 'isSocialCasino false');

  assert(
    resolveSocialCasinoMode({ devMode: true, devOverride: false, jurisdictionSocial: true }) === false,
    'dev social override beats jurisdiction',
  );
  assert(
    resolveSocialCasinoMode({ devMode: true, urlSocial: true, jurisdictionSocial: false }) === true,
    'dev url social param',
  );
  assert(
    resolveSocialCasinoMode({ devMode: false, jurisdictionSocial: true }) === true,
    'jurisdiction social in production',
  );
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
    amount: API,
    mode: 'BONUS',
  });
  assert(!bonusPlay.error && bonusPlay.round?.mode === 'BONUS', 'mock play accepts BONUS mode');
  assert(bonusPlay.round?.amount === 100 * API, 'mock stores total debit on round.amount');
}

function runBetConfigTests() {
  console.log('\nUnit — authenticate bet config');

  const filtered = parseAuthResponse({
    config: {
      minBet: 2 * API,
      maxBet: 5 * API,
      stepBet: API,
      defaultBetLevel: 4 * API,
      betLevels: [API, 2 * API, 3 * API, 4 * API, 5 * API, 10 * API],
    },
  });
  assert(filtered.betLevelsDisplay.join(',') === '2,3,4,5', 'betLevels filtered by min/max/step');
  assert(filtered.defaultBetDisplay === 4, 'defaultBetLevel kept when in allowed levels');
  assert(filtered.minBetApi === 2 * API, 'minBetApi parsed');
  assert(filtered.maxBetApi === 5 * API, 'maxBetApi parsed');
  assert(filtered.stepBetApi === API, 'stepBetApi parsed');
  assert(filtered.hasBetConfig, 'hasBetConfig when auth exposes bet params');

  const generated = parseAuthResponse({
    config: {
      minBet: API,
      maxBet: 5 * API,
      stepBet: API,
      defaultBetLevel: 3 * API,
    },
  });
  assert(generated.betLevelsDisplay.join(',') === '1,2,3,4,5', 'levels generated from min/max/step');
  assert(generated.defaultBetDisplay === 3, 'defaultBetLevel from generated ladder');

  const clampedDefault = parseAuthResponse({
    config: {
      minBet: API,
      maxBet: 5 * API,
      stepBet: API,
      defaultBetLevel: 7 * API,
      betLevels: [API, 2 * API, 3 * API, 4 * API, 5 * API],
    },
  });
  assert(clampedDefault.defaultBetDisplay === 5, 'defaultBetLevel clamped to max');

  const policy = createBetConfigPolicy(filtered);
  assert(policy.clampBaseBetApi(10 * API) === 5 * API, 'clampBaseBetApi snaps to max level');
  assert(policy.isAllowedBaseBetApi(3 * API), 'allowed bet in ladder');
  assert(!policy.isAllowedBaseBetApi(3.5 * API), 'disallowed off-ladder bet');

  let bet = 1;
  let betOptions = [1];
  const applied = applyAuthBetConfig(filtered, {
    getBet: () => bet,
    setBet: (value) => { bet = value; },
    getBetOptions: () => betOptions,
    setBetOptions: (levels) => { betOptions = levels; },
  });
  assert(applied, 'applyAuthBetConfig returns true');
  assert(bet === 4, 'applyAuthBetConfig sets default bet');
  assert(betOptions.join(',') === '2,3,4,5', 'applyAuthBetConfig sets bet options');

  const levelsOnly = buildBetLevelsApi({
    betLevels: [API, 5 * API, 10 * API],
    minBetApi: 2 * API,
    maxBetApi: 6 * API,
    stepBetApi: API,
  });
  assert(levelsOnly.join(',') === `${5 * API}`, 'explicit betLevels respect bounds');

  const stepped = clampBetApi(3.4 * API, {
    minBetApi: API,
    maxBetApi: 10 * API,
    stepBetApi: API,
    betLevelsApi: [],
  });
  assert(stepped === 3 * API, 'clampBetApi aligns to step without betLevels');

  const activeRoundAuth = parseAuthResponse({
    config: {
      minBet: API,
      maxBet: 10 * API,
      stepBet: API,
      defaultBetLevel: API,
      betLevels: [API, 2 * API, 3 * API, 4 * API, 5 * API],
    },
    round: {
      active: true,
      amount: 4 * API,
      mode: 'BASE',
      state: [{ index: 0, type: 'plinkoDrop' }],
    },
  });
  const basePolicy = createBetModePolicy({
    gameModes: [{ name: 'base', cost: 1 }],
    authBetModes: { BASE: { mode: 'BASE', costMultiplier: 1, feature: false } },
  });
  assert(
    applyAuthRoundBetOverride(activeRoundAuth, activeRoundAuth.round, basePolicy),
    'active round bet override applies',
  );
  assert(activeRoundAuth.defaultBetDisplay === 4, 'active round sets default bet from amount');
  assert(activeRoundAuth.usesActiveRoundBet, 'active round flag set');

  const bonusPolicy = createBetModePolicy({
    gameModes: [
      { name: 'base', cost: 1 },
      { name: 'bonus', cost: 100 },
    ],
    authBetModes: {
      BASE: { mode: 'BASE', costMultiplier: 1, feature: false },
      BONUS: { mode: 'BONUS', costMultiplier: 100, feature: true },
    },
  });
  const bonusRoundAuth = parseAuthResponse({
    config: {
      minBet: API,
      maxBet: 10 * API,
      stepBet: API,
      defaultBetLevel: API,
      betLevels: [API, 2 * API, 3 * API, 4 * API, 5 * API],
    },
    round: {
      active: true,
      amount: 400 * API,
      mode: 'BONUS',
      state: [{ index: 0, type: 'plinkoDrop' }],
    },
  });
  applyBetModeFromRound(bonusRoundAuth.round, bonusPolicy);
  applyAuthRoundBetOverride(bonusRoundAuth, bonusRoundAuth.round, bonusPolicy);
  assert(bonusPolicy.activeKey === 'bonus', 'active round selects matching bet mode');
  assert(bonusRoundAuth.defaultBetDisplay === 4, 'bonus debit amount maps to base bet chip');

  const inactiveRoundAuth = parseAuthResponse({
    config: {
      defaultBetLevel: API,
      betLevels: [API, 2 * API, 3 * API],
    },
    round: {
      active: false,
      amount: 3 * API,
      mode: 'BASE',
      state: [],
    },
  });
  assert(
    !applyAuthRoundBetOverride(inactiveRoundAuth, inactiveRoundAuth.round, basePolicy),
    'inactive round does not override default bet',
  );
  assert(inactiveRoundAuth.defaultBetDisplay === 1, 'inactive round keeps config default');
}

function runCurrencyCopyTests() {
  console.log('\nUnit — currency & social copy');

  const usd = formatCurrencyAmount(12.5, 'USD', { locale: 'en' });
  assert(usd.includes('12.50'), 'USD format');

  const xgc = formatCurrencyAmount(100, 'XGC');
  assert(xgc === 'GC 100.00', 'XGC social currency label');

  const xec = formatCurrencyAmount(1000, 'XEC');
  assert(xec === 'SC 1000.00', 'XEC social currency label');

  const xsc = formatCurrencyAmount(50, 'XSC');
  assert(xsc === 'SC 50.00', 'XSC social currency label');

  const winUsd = formatWinAmount(1.234567, 'USD', { locale: 'en' });
  assert(winUsd.includes('1.234567'), 'USD win preserves full precision');
  assert(winUsd.includes('4567'), 'USD win shows sub-cent digits');

  const balanceRounded = formatCurrencyAmount(1.234567, 'USD', { locale: 'en' });
  assert(balanceRounded.includes('1.23'), 'USD balance rounded to 2 decimals');

  const winXgc = formatWinAmount(0.123456, 'XGC');
  assert(winXgc === 'GC 0.123456', 'XGC win preserves full precision');

  const winXec = formatWinAmount(0.5, 'XEC');
  assert(winXec === 'SC 0.50', 'XEC win uses SC label');

  const rgsFallback = formatCurrencyAmount(10, 'XYZ', { currencyDisplay: 'SC' });
  assert(rgsFallback === 'SC 10.00', 'RGS display fallback when Intl fails');

  const formatterFallback = createCurrencyFormatter({ currency: 'XYZ', currencyDisplay: 'SC' });
  assert(formatterFallback.formatBalance(12.5) === 'SC 12.50', 'formatter RGS display fallback');

  const parsedXec = parseAuthResponse({
    balance: { amount: API, currency: 'XEC', currencyDisplay: 'SC' },
  });
  assert(parsedXec.currency === 'XEC', 'auth keeps internal XEC code');
  assert(parsedXec.currencyDisplay === 'SC', 'auth reads balance.currencyDisplay');

  const eur = createCurrencyFormatter({ currency: 'EUR', language: 'en' });
  assert(eur.format(1).includes('1.00'), 'EUR formatter balance');
  assert(eur.formatWin(1.234567).includes('1.234567'), 'EUR formatter win precision');

  const real = createCopyPolicy({ socialCasino: false });
  const social = createCopyPolicy({ socialCasino: true });
  assert(real.term('balance') === 'Balance', 'real money balance label');
  assert(social.term('balance') === 'Balance', 'social casino keeps balance label');
  assert(social.term('win') === 'Earn', 'social casino win label');
  assert(
    modeButtonLabel({ key: 'bonus', type: 'buy', costMultiplier: 100 }, real.t.bind(real)) === 'Buy bonus ×100',
    'buy mode label via copy policy',
  );
  const socialBuy = modeButtonLabel({ key: 'bonus', type: 'buy', costMultiplier: 100 }, social.t.bind(social));
  assert(socialBuy === 'Feature ×100', 'social buy mode label');
  assert(!/\b(buy|bet|pay)\b/i.test(socialBuy), 'social mode label avoids buy/bet/pay');
  assert(social.t('buyPlayButton') === 'Play feature', 'social buy play button');
  assert(!/\b(buy|bet|pay)\b/i.test(social.t('buyPlayButton')), 'social buy play button avoids buy/bet/pay');
  assert(social.t('modeInfoBase') === 'Base Play', 'social game info base mode');
  assert(real.term('insufficientBalance') === 'Insufficient Funds.', 'exact insufficient funds copy');
  assert(social.term('insufficientBalance') === 'Insufficient Balance.', 'exact insufficient balance social');

  const summary = formatReplayStartSummary(
    real,
    { playAmount: 1, payoutMultiplier: 7, finalAmount: 7 },
    { formatBalance: (n) => `$${n.toFixed(2)}`, formatWin: (n) => `$${n}`, formatMult: (n) => `${n}×` },
  );
  assert(summary.includes('Play cost'), 'replay intro play cost');
  assert(summary.includes('Payout multiplier'), 'replay intro payout multiplier');
  assert(summary.includes('No live bet is placed'), 'replay intro includes not-a-live-bet disclaimer');

  const chrome = { dataset: {} };
  const replayLabel = { textContent: '' };
  const replayNote = { textContent: '' };
  const banner = {
    hidden: true,
    querySelector(sel) {
      if (sel === '.replay-label') return replayLabel;
      if (sel === '.replay-note') return replayNote;
      return null;
    },
    setAttribute() {},
  };
  applyReplayModeChrome({ shell: chrome, banner, noteEl: replayNote, copy: real });
  assert(chrome.dataset.sukiReplay === 'true', 'replay chrome marks shell');
  assert(replayLabel.textContent === 'Replay mode', 'replay chrome sets title');
  assert(replayNote.textContent.includes('No live bet'), 'replay chrome sets disclaimer');
  assert(banner.hidden === false, 'replay chrome shows banner');

  const socialSummary = formatReplayStartSummary(
    social,
    { playAmount: 1, payoutMultiplier: 7, finalAmount: 7 },
    { formatBalance: (n) => `$${n.toFixed(2)}`, formatWin: (n) => `$${n}`, formatMult: (n) => `${n}×` },
  );
  assert(socialSummary.includes('Play amount'), 'social replay play amount label');
  assert(!socialSummary.toLowerCase().includes('cost'), 'social replay avoids cost');
  assert(social.term('baseBetLabel') === 'Base Play', 'stake.us base play label');
  assert(social.term('costMultiplierLabel') === 'Feature Multiplier', 'stake.us feature multiplier');
  assert(social.term('payoutMultiplierLabel') === 'Final multiplier', 'stake.us final multiplier');

  const label = { textContent: '' };
  applyCopyLabels(social, { balanceLabel: label });
  assert(label.textContent === 'Balance', 'applyCopyLabels keeps balance in social');

  const betLabel = { textContent: '' };
  applyCopyLabels(real, { betLabel });
  assert(betLabel.textContent === 'Bet amount', 'bet HUD label uses betAmount term');
  applyCopyLabels(social, { betLabel });
  assert(betLabel.textContent === 'Play amount', 'social bet HUD label uses betAmount term');

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
  assert(enUi.t('generalDisclaimerTitle') === 'General Disclaimer', 'general disclaimer title');
  assert(
    enUi.t('generalDisclaimer').includes('Malfunction voids all wins and plays'),
    'general disclaimer body',
  );
  assert(
    enUi.t('generalDisclaimer').includes('Remote Game Server'),
    'general disclaimer RGS settlement',
  );
  assert(deUi.t('balance') === 'Guthaben', 'de balance');
  assert(enSocial.t('balance') === 'Balance', 'en social balance');
  assert(enSocial.t('win') === 'Earn', 'en social win');
  assert(enSocial.t('paytableMenuLabel') === 'Win table', 'en social paytable menu label');
  assert(enSocial.t('paytableTitle') === 'Win table', 'en social paytable title');
  assert(!/\b(buy|bet|pay)\b/i.test(enSocial.t('paytableMenuLabel')), 'en social paytable label avoids buy/bet/pay');
  assert(
    enSocial.t('roundingNote').includes('Earn amounts'),
    'en social rounding note uses earn terminology',
  );
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

  assert(shouldSkipEndRound({ payout: 0, payoutMultiplier: 0 }), 'skip end-round on zero win');
  assert(shouldSkipEndRound({ payoutMultiplier: 0 }), 'skip end-round when multiplier is 0');
  assert(!shouldSkipEndRound({ payout: 10, payoutMultiplier: 0.1 }), 'end-round on partial win');
  assert(!shouldSkipEndRound({ payout: 1 }), 'end-round when payout > 0');

  const zeroWinRgs = createMockRgs({
    gameId: 'zero-win',
    replayVersion: '1',
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
  const zeroSession = 'zero-win-session';
  zeroWinRgs.handleRgsRequest('/wallet/authenticate', { sessionID: zeroSession, gameID: 'zero-win' });
  const zeroPlay = zeroWinRgs.handleRgsRequest('/wallet/play', {
    sessionID: zeroSession,
    gameID: 'zero-win',
    amount: API,
    mode: 'BASE',
  });
  assert(!zeroPlay.error && zeroPlay.round?.payout === 0, 'zero-win play succeeds');
  assert(zeroPlay.round?.active === false, 'zero-win round auto-closed on play');
  const zeroPlay2 = zeroWinRgs.handleRgsRequest('/wallet/play', {
    sessionID: zeroSession,
    gameID: 'zero-win',
    amount: API,
    mode: 'BASE',
  });
  assert(!zeroPlay2.error, 'second play after zero win without end-round');

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
  runReplayLaunchTests();
  runBootstrapTests();
  runScreenPreviewTests();
  runStakeLayoutTests();
  runBetUiTests();
  runBalanceGuardTests();
  runAutoplayConfirmTests();
  runGameMenuTests();
  runSpineAssetTests();
  runBetModeTests();
  runBetConfigTests();
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
