/**
 * ERR_* scenario harness — policy matrix + mock RGS injection paths.
 *
 * Usage: node harness/err-scenarios.mjs
 *
 * Mock injection (dev / harness only):
 *   { _mock: { error: 'ERR_GLE' } }           — current endpoint
 *   { _mock: { play_error: 'ERR_UE' } }       — endpoint-specific
 *   { _mock: { err_is: true } }               — authenticate → ERR_IS
 */

import { createMockRgs } from '../server/mock-rgs/create-mock-rgs.mjs';
import {
  classifyRgsError,
  messageForRgsCode,
  applyRgsError,
  isSessionFatal,
} from '../client/suki/errors.js';
import { withRgsCall } from '../client/suki/rgsTransport.js';

const API = 1_000_000;

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

/** @type {Record<string, { action: string, fatal: boolean, blockBet: boolean, shouldResumeRound: boolean, retryable: boolean }>} */
export const EXPECTED_POLICIES = {
  ERR_IS: { action: 'fatal', fatal: true, blockBet: true, shouldResumeRound: false, retryable: false },
  ERR_ATE: { action: 'fatal', fatal: true, blockBet: true, shouldResumeRound: false, retryable: false },
  ERR_GLE: { action: 'fatal', fatal: true, blockBet: true, shouldResumeRound: false, retryable: false },
  ERR_IPB: { action: 'block_bet', fatal: false, blockBet: true, shouldResumeRound: false, retryable: false },
  ERR_BE: { action: 'resume_round', fatal: false, blockBet: true, shouldResumeRound: true, retryable: false },
  ERR_BNF: { action: 'info', fatal: false, blockBet: false, shouldResumeRound: false, retryable: false },
  ERR_UE: { action: 'retry', fatal: false, blockBet: true, shouldResumeRound: false, retryable: true },
  ERR_GE: { action: 'retry', fatal: false, blockBet: true, shouldResumeRound: false, retryable: true },
  ERR_GEN: { action: 'retry', fatal: false, blockBet: true, shouldResumeRound: false, retryable: true },
  ERR_VAL: { action: 'info', fatal: false, blockBet: false, shouldResumeRound: false, retryable: false },
};

function createHarnessRgs() {
  return createMockRgs({
    gameId: 'err-test',
    replayVersion: '1',
    resolvePlay(_session, body) {
      const amount = Number(body.amount);
      return {
        payout: Math.round(amount * 1.1),
        payoutMultiplier: 1.1,
        state: [{ index: 0, type: 'testEvent' }],
      };
    },
    resolveReplay() {
      return null;
    },
  });
}

function runPolicyMatrix() {
  console.log('\nPolicy matrix — classifyRgsError');

  for (const [code, expected] of Object.entries(EXPECTED_POLICIES)) {
    const policy = classifyRgsError(code);
    assert(policy.action === expected.action, `${code} action=${expected.action}`);
    assert(policy.fatal === expected.fatal, `${code} fatal=${expected.fatal}`);
    assert(policy.blockBet === expected.blockBet, `${code} blockBet=${expected.blockBet}`);
    assert(policy.shouldResumeRound === expected.shouldResumeRound, `${code} resume=${expected.shouldResumeRound}`);
    assert(policy.retryable === expected.retryable, `${code} retryable=${expected.retryable}`);
    assert(policy.message === messageForRgsCode(code), `${code} message mapped`);
  }

  const unknown = classifyRgsError('ERR_CUSTOM');
  assert(unknown.action === 'info' && !unknown.fatal, 'unknown code defaults to info');

  assert(isSessionFatal('ERR_IS') && isSessionFatal('ERR_GLE'), 'session fatal codes');
  assert(!isSessionFatal('ERR_IPB') && !isSessionFatal('ERR_BE'), 'non-fatal bet codes');
}

function runApplyRgsError() {
  console.log('\nPolicy matrix — applyRgsError');

  let message = '';
  let fatal = false;
  let blocked = false;

  applyRgsError('ERR_IS', {
    setMessage: (text) => {
      message = text;
    },
    onFatal: () => {
      fatal = true;
    },
    onBlockBet: () => {
      blocked = true;
    },
  });
  assert(fatal && blocked, 'ERR_IS triggers fatal + blockBet');
  assert(message.includes('Session expired'), 'ERR_IS player message');

  message = '';
  fatal = false;
  blocked = false;
  applyRgsError('ERR_IPB', {
    setMessage: (text) => {
      message = text;
    },
    onFatal: () => {
      fatal = true;
    },
    onBlockBet: () => {
      blocked = true;
    },
  });
  assert(!fatal && blocked, 'ERR_IPB blocks bet only');
  assert(message.includes('balance'), 'ERR_IPB player message');
}

async function runTransportRetry() {
  console.log('\nTransport — withRgsCall retry');

  let attempts = 0;
  const ok = await withRgsCall(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('ERR_UE');
    return 'done';
  }, { maxAttempts: 3, delayMs: 5 });
  assert(ok === 'done' && attempts === 3, 'ERR_UE retries until success');

  let ipbAttempts = 0;
  try {
    await withRgsCall(async () => {
      ipbAttempts += 1;
      throw new Error('ERR_IPB');
    }, { maxAttempts: 3, delayMs: 5 });
    assert(false, 'ERR_IPB should not retry');
  } catch (err) {
    assert(ipbAttempts === 1 && String(err.message) === 'ERR_IPB', 'ERR_IPB fails fast');
  }
}

function runMockScenarios() {
  console.log('\nMock RGS — ERR scenarios');
  const rgs = createHarnessRgs();
  const base = { gameID: 'err-test', language: 'en' };

  const errIs = rgs.handleRgsRequest('/wallet/authenticate', {
    ...base,
    sessionID: 'err-is',
    _mock: { err_is: true },
  });
  assert(errIs.error?.code === 'ERR_IS', 'authenticate ERR_IS via err_is');

  const errAte = rgs.handleRgsRequest('/wallet/authenticate', {
    ...base,
    sessionID: 'err-ate',
    _mock: { authenticate_error: 'ERR_ATE' },
  });
  assert(errAte.error?.code === 'ERR_ATE', 'authenticate ERR_ATE via authenticate_error');

  const errGle = rgs.handleRgsRequest('/wallet/play', {
    ...base,
    sessionID: 'err-gle',
    amount: API,
    mode: 'BASE',
    _mock: { error: 'ERR_GLE' },
  });
  assert(errGle.error?.code === 'ERR_GLE', 'play ERR_GLE via error');

  const errUe = rgs.handleRgsRequest('/wallet/play', {
    ...base,
    sessionID: 'err-ue',
    amount: API,
    mode: 'BASE',
    _mock: { play_error: 'ERR_UE' },
  });
  assert(errUe.error?.code === 'ERR_UE', 'play ERR_UE via play_error');

  const sessionIPB = 'err-ipb';
  rgs.handleRgsRequest('/wallet/authenticate', { ...base, sessionID: sessionIPB });
  const errIpb = rgs.handleRgsRequest('/wallet/play', {
    ...base,
    sessionID: sessionIPB,
    amount: 999_999 * API,
    mode: 'BASE',
  });
  assert(errIpb.error?.code === 'ERR_IPB', 'play ERR_IPB insufficient balance');

  const sessionBE = 'err-be';
  rgs.handleRgsRequest('/wallet/authenticate', { ...base, sessionID: sessionBE });
  rgs.handleRgsRequest('/wallet/play', {
    ...base,
    sessionID: sessionBE,
    amount: API,
    mode: 'BASE',
  });
  const errBe = rgs.handleRgsRequest('/wallet/play', {
    ...base,
    sessionID: sessionBE,
    amount: API,
    mode: 'BASE',
  });
  assert(errBe.error?.code === 'ERR_BE', 'play ERR_BE round already active');

  const errBnf = rgs.handleReplayRequest('err-test', '1', 'base', 'missing-event', null);
  assert(errBnf.error?.code === 'ERR_BNF', 'replay ERR_BNF not found');

  const sessionGE = 'err-ge';
  rgs.handleRgsRequest('/wallet/authenticate', { ...base, sessionID: sessionGE });
  const errGe = rgs.handleRgsRequest('/wallet/end-round', {
    ...base,
    sessionID: sessionGE,
    _mock: { end_round_error: 'ERR_GE' },
  });
  assert(errGe.error?.code === 'ERR_GE', 'end-round ERR_GE via end_round_error');

  const errValPlay = rgs.handleRgsRequest('/wallet/play', {
    ...base,
    sessionID: 'err-val',
    amount: -1,
    mode: 'BASE',
  });
  assert(errValPlay.error?.code === 'ERR_VAL', 'play ERR_VAL invalid amount');

  const sessionEvent = 'err-event';
  rgs.handleRgsRequest('/wallet/authenticate', { ...base, sessionID: sessionEvent });
  rgs.handleRgsRequest('/wallet/play', {
    ...base,
    sessionID: sessionEvent,
    amount: API,
    mode: 'BASE',
  });
  const errEvent = rgs.handleBetEvent({
    ...base,
    sessionID: sessionEvent,
    _mock: { bet_event_error: 'ERR_GEN' },
    event: '0',
  });
  assert(errEvent.error?.code === 'ERR_GEN', 'bet/event ERR_GEN via bet_event_error');

  const errAction = rgs.handleBetAction({
    ...base,
    sessionID: 'no-active',
    action: 'PICK',
    _mock: { error: 'ERR_VAL' },
  });
  assert(errAction.error?.code === 'ERR_VAL', 'bet/action ERR_VAL inject');

  const errBalance = rgs.handleRgsRequest('/wallet/balance', {
    ...base,
    sessionID: 'err-bal',
    _mock: { balance_error: 'ERR_SCR' },
  });
  assert(errBalance.error?.code === 'ERR_SCR', 'balance ERR_SCR via balance_error');
}

function runPolicyMockAlignment() {
  console.log('\nAlignment — mock codes match policy');

  const rgs = createHarnessRgs();
  const cases = [
    { code: 'ERR_IS', res: rgs.handleRgsRequest('/wallet/authenticate', { sessionID: 'a', _mock: { err_is: true } }) },
    { code: 'ERR_GLE', res: rgs.handleRgsRequest('/wallet/play', { sessionID: 'b', amount: API, _mock: { error: 'ERR_GLE' } }) },
    { code: 'ERR_BE', res: (() => {
      rgs.handleRgsRequest('/wallet/play', { sessionID: 'c', amount: API, mode: 'BASE' });
      return rgs.handleRgsRequest('/wallet/play', { sessionID: 'c', amount: API, mode: 'BASE' });
    })() },
    { code: 'ERR_BNF', res: rgs.handleReplayRequest('err-test', '1', 'base', 'nope', null) },
  ];

  for (const { code, res } of cases) {
    const returned = res.error?.code;
    const expected = EXPECTED_POLICIES[code];
    const policy = classifyRgsError(returned);
    assert(returned === code, `${code} returned from mock`);
    if (expected) {
      assert(policy.action === expected.action, `${code} policy action aligned`);
    }
  }
}

async function main() {
  console.log('Suki Engine — ERR scenario harness');

  runPolicyMatrix();
  runApplyRgsError();
  await runTransportRetry();
  runMockScenarios();
  runPolicyMockAlignment();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
