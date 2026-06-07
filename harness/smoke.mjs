/**
 * Suki Engine compliance smoke tests.
 *
 * Unit (default): in-process mock RGS — no server required.
 * Integration: set SUKI_SMOKE_URL=http://127.0.0.1:5174 to hit a live game host.
 *
 * Usage: node harness/smoke.mjs
 */

import { createMockRgs } from '../server/mock-rgs/create-mock-rgs.mjs';

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

async function main() {
  console.log('Suki Engine — compliance smoke');
  runUnitTests();

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
