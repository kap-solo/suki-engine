/**
 * Node RGS HTTP client — for sandbox smoke tests against real Stake RGS.
 */

/**
 * @param {string} baseUrl — https://rgs.example.com
 * @param {string} path — /wallet/authenticate
 * @param {object} body
 */
export async function rgsPost(baseUrl, path, body) {
  const base = baseUrl.replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`HTTP_${response.status}: non-JSON response`);
  }

  if (!response.ok || data.error) {
    const code = data.error?.code || data.error?.statusCode || `HTTP_${response.status}`;
    const err = new Error(code);
    err.response = data;
    throw err;
  }

  return data;
}

/**
 * Full wallet smoke against a live RGS (authenticate → play → events → end-round).
 *
 * @param {object} options
 * @param {string} options.rgsUrl
 * @param {string} options.sessionID
 * @param {string} options.gameID
 * @param {string} [options.language]
 * @param {number} [options.amountApi]
 * @param {boolean} [options.dryRun] — authenticate + balance only
 */
export async function runSandboxWalletFlow(options) {
  const {
    rgsUrl,
    sessionID,
    gameID,
    language = 'en',
    amountApi = 1_000_000,
    dryRun = false,
  } = options;

  const auth = await rgsPost(rgsUrl, '/wallet/authenticate', {
    sessionID,
    language,
    gameID,
  });

  const balance = await rgsPost(rgsUrl, '/wallet/balance', { sessionID, gameID });

  if (dryRun) {
    return { auth, balance, play: null, end: null };
  }

  const play = await rgsPost(rgsUrl, '/wallet/play', {
    sessionID,
    gameID,
    amount: amountApi,
    currency: 'USD',
    mode: 'BASE',
  });

  const events = play.round?.state ?? [];
  for (const event of events) {
    if (event.index === undefined) continue;
    await rgsPost(rgsUrl, '/bet/event', {
      sessionID,
      gameID,
      event: String(event.index),
    });
  }

  const end = await rgsPost(rgsUrl, '/wallet/end-round', { sessionID, gameID });

  return { auth, balance, play, end };
}
