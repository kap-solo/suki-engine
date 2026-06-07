/**
 * Run the full Suki compliance checklist (smoke + optional math validation)
 * and print a one-page compliance report for provider outlines.
 *
 * Usage:
 *   node harness/compliance-checklist.mjs
 *   node harness/compliance-checklist.mjs --math ../Pure-Plinko/data
 *   node harness/compliance-checklist.mjs --math ../Pure-Plinko/data --out=./compliance-report.md
 */

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildComplianceReport,
  parseTestCounts,
  printComplianceReport,
} from './compliance-report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const mathArg = process.argv.find((a) => a.startsWith('--math'));
const mathDir = mathArg
  ? mathArg.includes('=')
    ? mathArg.split('=')[1]
    : process.argv[process.argv.indexOf('--math') + 1]
  : null;

const outArg = process.argv.find((a) => a.startsWith('--out'));
const outPath = outArg
  ? resolve(outArg.includes('=') ? outArg.split('=')[1] : process.argv[process.argv.indexOf('--out') + 1])
  : null;

/** @type {import('./compliance-report.mjs').CheckStep[]} */
const steps = [];

/**
 * @param {string} name
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [env]
 */
function run(name, args, env = {}) {
  console.log(`\n▶ ${name}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const stdout = result.stdout ?? '';
  const counts = parseTestCounts(stdout);
  const ok = result.status === 0;

  let note;
  if (!counts?.passed && ok && /OK —/.test(stdout)) {
    const modeLine = stdout.match(/mode \w+: .+/);
    note = modeLine ? `${modeLine[0]} — OK` : 'bundle OK';
  }

  steps.push({
    name,
    status: ok ? 'pass' : 'fail',
    passed: counts?.passed,
    failed: counts?.failed,
    note,
  });

  if (!ok) {
    console.error(`\n✗ ${name} failed`);
    process.exit(result.status ?? 1);
  }

  console.log(`✓ ${name}`);
}

function skip(name, note) {
  steps.push({ name, status: 'skip', note });
  console.log(`\n(skip ${name} — ${note})`);
}

console.log('Suki compliance checklist');

run('Smoke tests', [join(root, 'harness/smoke.mjs')]);
run('ERR scenarios', [join(root, 'harness/err-scenarios.mjs')]);

if (process.env.SUKI_RGS_URL && process.env.SUKI_SESSION_ID && process.env.SUKI_GAME_ID) {
  run('Stake RGS sandbox', [join(root, 'harness/sandbox-smoke.mjs')]);
} else {
  skip('Stake RGS sandbox', 'set SUKI_RGS_URL, SUKI_SESSION_ID, SUKI_GAME_ID');
}

if (mathDir) {
  run('Math validation', [join(root, 'tools/validate-math.mjs'), mathDir]);
} else {
  skip('Math validation', 'pass --math <dataDir>');
}

console.log('\nAll checks passed.');

const report = buildComplianceReport({
  steps,
  mathDir,
  gameId: process.env.SUKI_GAME_ID ?? (mathDir ? 'pure-plinko' : null),
});

printComplianceReport(report, { outPath });
