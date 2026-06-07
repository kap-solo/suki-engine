/**
 * Run the full Suki compliance checklist (smoke + optional math validation).
 *
 * Usage:
 *   node harness/compliance-checklist.mjs
 *   node harness/compliance-checklist.mjs --math ../Pure-Plinko/data
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mathArg = process.argv.find((a) => a.startsWith('--math'));
const mathDir = mathArg ? mathArg.split('=')[1] ?? process.argv[process.argv.indexOf('--math') + 1] : null;

function run(label, args, env = {}) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${label}`);
}

console.log('Suki compliance checklist');

run('Smoke tests', [join(root, 'harness/smoke.mjs')]);
run('ERR scenarios', [join(root, 'harness/err-scenarios.mjs')]);

if (process.env.SUKI_RGS_URL && process.env.SUKI_SESSION_ID && process.env.SUKI_GAME_ID) {
  run('Stake RGS sandbox', [join(root, 'harness/sandbox-smoke.mjs')]);
} else {
  console.log('\n(skip sandbox — set SUKI_RGS_URL, SUKI_SESSION_ID, SUKI_GAME_ID for live RGS)');
}

if (mathDir) {
  run('Math validation', [join(root, 'tools/validate-math.mjs'), mathDir]);
} else {
  console.log('\n(skip math — pass --math <dataDir> to validate a bundle)');
}

console.log('\nAll checks passed.');
