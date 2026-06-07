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
  buildRgsConfig,
  normalizeRgsBase,
  validateRgsConfig,
  isLocalRgsUrl,
} from '../client/suki/rgsConfig.js';
import { createGameBootstrap } from '../client/suki/gameBootstrap.js';
import { formatSessionElapsed, createSessionTimer } from '../client/suki/sessionTimer.js';
import { formatCurrencyAmount, createCurrencyFormatter } from '../client/suki/currency.js';
import { createCopyPolicy, applyCopyLabels } from '../client/suki/copy.js';
import { setPlayerCurrency, getPlayerCurrency } from '../client/suki/playerCurrency.js';
import { parseAuthResponse } from '../client/suki/authConfig.js';

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
  console.log(`\nIntegration — ${baseUrl}`);
  const sessionID = `live-${Date.now()}`;
  const base = baseUrl.replace(/\/$/, '');

  const auth = await post(base, '/wallet/authenticate', {
    sessionID,
    gameID: 'pure-plinko',
    language: 'en',
  });
  assert(!auth.error, 'authenticate');
  assert(auth.config?.gameID === 'pure-plinko', 'game id');

  const play = await post(base, '/wallet/play', {
    sessionID,
    gameID: 'pure-plinko',
    amount: API,
    mode: 'BASE',
  });
  assert(!play.error, 'play');
  assert(play.round?.state?.some((e) => e.type === 'plinkoDrop'), 'plinkoDrop in state');

  const end = await post(base, '/wallet/end-round', { sessionID, gameID: 'pure-plinko' });
  assert(!end.error, 'end-round');

  const replayRes = await fetch(`${base}/bet/replay/pure-plinko/1/base/1?amount=${API}`);
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

  const sandboxVal = validateRgsConfig(prodCfg, 'sandbox');
  assert(sandboxVal.ok, 'sandbox accepts remote RGS');
}

function runBootstrapTests() {
  console.log('\nUnit — game bootstrap');
  assert(typeof createGameBootstrap === 'function', 'createGameBootstrap exported');
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
  assert(social.term('insufficientBalance').includes('coins'), 'social insufficient copy');

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

async function runPolicyTests() {
  console.log('\nUnit — error policy & transport');
  assert(classifyRgsError('ERR_UE').retryable, 'ERR_UE is retryable');
  assert(!classifyRgsError('ERR_IPB').retryable, 'ERR_IPB is not retryable');
  assert(classifyRgsError('ERR_BE').shouldResumeRound, 'ERR_BE resumes round');

  let attempts = 0;
  const value = await withRgsCall(async () => {
    attempts += 1;
    if (attempts < 2) throw new Error('ERR_GEN');
    return 'ok';
  }, { delayMs: 10 });
  assert(value === 'ok' && attempts === 2, 'withRgsCall retries then succeeds');
}

async function main() {
  console.log('Suki Engine — compliance smoke');
  runUnitTests();
  runRgsConfigTests();
  runBootstrapTests();
  runCurrencyCopyTests();
  runSessionTimerTests();
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
