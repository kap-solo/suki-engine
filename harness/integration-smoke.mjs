/**
 * Start template/new-game host and run live HTTP integration tests.
 *
 * Usage: npm run test:integration
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const templateRoot = join(root, 'template/new-game');
const port = process.env.SMOKE_PORT || '5199';
const baseUrl = `http://127.0.0.1:${port}`;
const API = 1_000_000;
const gameID = process.env.SUKI_INTEGRATION_GAME_ID || 'my-game';
const eventType = process.env.SUKI_INTEGRATION_EVENT_TYPE || 'gameReveal';

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await wait(250);
  }
  throw new Error(`Server did not respond at ${url}`);
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

function stopServer(child) {
  if (!child?.pid || child.killed) return;
  child.kill('SIGTERM');
}

console.log('Suki — template integration smoke');
console.log(`  Host: ${templateRoot}`);
console.log(`  Port: ${port}`);

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: templateRoot,
  env: { ...process.env, PORT: port, HOST: '127.0.0.1' },
  stdio: 'ignore',
});

try {
  await waitForServer(`${baseUrl}/`);

  console.log(`\nIntegration — ${baseUrl} (${gameID})`);
  const sessionID = `live-${Date.now()}`;

  const auth = await post('/wallet/authenticate', {
    sessionID,
    gameID,
    language: 'en',
  });
  assert(!auth.error, 'authenticate');
  assert(auth.config?.gameID === gameID, 'game id');

  const play = await post('/wallet/play', {
    sessionID,
    gameID,
    amount: API,
    mode: 'BASE',
  });
  assert(!play.error, 'play');
  assert(play.round?.state?.some((e) => e.type === eventType), `${eventType} in state`);

  const end = await post('/wallet/end-round', { sessionID, gameID });
  assert(!end.error, 'end-round');

  const replayRes = await fetch(`${baseUrl}/bet/replay/${gameID}/1/base/1?amount=${API}`);
  const replay = await replayRes.json();
  assert(!replay.error, 'book replay GET');

  console.log(`\n${passed} passed, ${failed} failed`);
} catch (err) {
  failed += 1;
  console.error(`  ✗ ${err.message}`);
} finally {
  stopServer(server);
  await wait(300);
}

process.exit(failed > 0 ? 1 : 0);
