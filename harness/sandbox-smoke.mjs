/**
 * Smoke test against a real Stake RGS sandbox.
 *
 * Required env:
 *   SUKI_RGS_URL       — host or URL, e.g. rgs.stake-engine.com or https://rgs.stake-engine.com
 *   SUKI_SESSION_ID    — session from Stake launch URL
 *   SUKI_GAME_ID       — game id, e.g. pure-plinko
 *
 * Optional:
 *   SUKI_RGS_DRY_RUN=1 — authenticate + balance only (no play)
 *   SUKI_PLAY_AMOUNT   — API amount for play (default 1000000)
 *
 * Usage:
 *   SUKI_RGS_URL=rgs.example.com SUKI_SESSION_ID=... SUKI_GAME_ID=pure-plinko node harness/sandbox-smoke.mjs
 */

import { normalizeRgsBase, isLocalRgsUrl } from '../client/suki/rgsConfig.js';
import { runSandboxWalletFlow } from '../server/rgs-client.mjs';

const rgsUrl = normalizeRgsBase(process.env.SUKI_RGS_URL || '');
const sessionID = process.env.SUKI_SESSION_ID || '';
const gameID = process.env.SUKI_GAME_ID || '';
const dryRun = process.env.SUKI_RGS_DRY_RUN === '1';
const amountApi = Number(process.env.SUKI_PLAY_AMOUNT) || 1_000_000;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!rgsUrl) fail('SUKI_RGS_URL is required');
if (isLocalRgsUrl(rgsUrl)) fail('SUKI_RGS_URL must be a remote Stake RGS host, not localhost');
if (!sessionID) fail('SUKI_SESSION_ID is required');
if (!gameID) fail('SUKI_GAME_ID is required');

console.log('Suki — Stake RGS sandbox smoke');
console.log(`  RGS:     ${rgsUrl}`);
console.log(`  Game:    ${gameID}`);
console.log(`  Session: ${sessionID.slice(0, 8)}…`);
console.log(`  Mode:    ${dryRun ? 'dry-run (auth + balance)' : 'full wallet flow'}`);

try {
  const result = await runSandboxWalletFlow({
    rgsUrl,
    sessionID,
    gameID,
    amountApi,
    dryRun,
  });

  console.log('  ✓ authenticate');
  const bal = result.balance?.balance ?? result.auth?.balance;
  console.log(`  ✓ balance (${bal?.currency ?? 'USD'} ${bal?.amount ?? '?'})`);

  if (!dryRun) {
    const eventCount = result.play?.round?.state?.length ?? 0;
    console.log(`  ✓ play (${eventCount} book events)`);
    console.log('  ✓ bet/event for each step');
    console.log('  ✓ end-round');
  }

  console.log('\nSandbox smoke passed.');
} catch (err) {
  console.error(`\n✗ Sandbox smoke failed: ${err.message}`);
  if (err.response) {
    console.error(JSON.stringify(err.response, null, 2));
  }
  process.exit(1);
}
