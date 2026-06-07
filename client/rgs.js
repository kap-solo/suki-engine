import { API_AMOUNT_MULTIPLIER } from './money.js';
import {
  getGameId,
  getReplayVersion,
  getSessionStorageKey,
  isReplayMode as isReplayModeConfig,
  getMockFlags,
} from './suki/config.js';
import { messageForRgsCode } from './suki/errors.js';
import { buildRgsConfig, describeRgsMode } from './suki/rgsConfig.js';
import { getEnvironment } from './suki/environment.js';
import { getPlayerCurrency } from './suki/playerCurrency.js';

export { initSuki, getSukiConfig, getDevComplianceLabel, getJurisdictionProfileName } from './suki/config.js';
export { messageForRgsCode, classifyRgsError, applyRgsError, isSessionFatal } from './suki/errors.js';
export {
  getEnvironment,
  isProduction,
  isDevelopment,
  isReplayEnvironment,
  isSandboxEnvironment,
  showDevTools,
  showComplianceFooter,
  shouldReportBetEvents,
} from './suki/environment.js';
export {
  buildRgsConfig,
  normalizeRgsBase,
  validateRgsConfig,
  isLocalRgsUrl,
  describeRgsMode,
} from './suki/rgsConfig.js';
export { isDevMode, isSandboxMode } from './suki/config.js';
export { isReplayMode } from './suki/config.js';
export { API_AMOUNT_MULTIPLIER } from './money.js';

export function getSessionID() {
  const key = getSessionStorageKey();
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('sessionID');
  if (fromUrl) {
    sessionStorage.setItem(key, fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem(key) || 'local-demo';
}

/** New RGS session — fresh server balance on next authenticate. */
export function startNewRgsSession() {
  const key = getSessionStorageKey();
  const sessionID = `local-${Date.now().toString(36)}`;
  sessionStorage.setItem(key, sessionID);
  const url = new URL(window.location.href);
  url.searchParams.set('sessionID', sessionID);
  history.replaceState(null, '', url);
  return sessionID;
}

/** @returns {ReturnType<typeof buildRgsConfig>} */
export function getRgsParams() {
  return buildRgsConfig({
    gameId: getGameId(),
    storedSessionID: getSessionID(),
    origin: window.location.origin,
    searchParams: new URLSearchParams(window.location.search),
  });
}

/** Connection summary for dev/sandbox compliance footer. */
export function getRgsConnectionInfo() {
  const config = getRgsParams();
  return {
    ...config,
    environment: getEnvironment(),
    modeLabel: describeRgsMode(getEnvironment()),
  };
}

async function rgsPost(path, body) {
  const { rgsUrl } = getRgsParams();
  // Stake host-only rgs_url is normalized to https:// in buildRgsConfig
  const response = await fetch(`${rgsUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    const code = data.error?.code || data.error?.statusCode || `HTTP_${response.status}`;
    throw new Error(code);
  }
  return data;
}

export async function authenticate() {
  const { sessionID, language, gameID } = getRgsParams();
  const body = { sessionID, language, gameID };
  const mock = getMockFlags();
  if (mock) body._mock = mock;
  return rgsPost('/wallet/authenticate', body);
}

export async function fetchBalance() {
  const { sessionID, gameID } = getRgsParams();
  const data = await rgsPost('/wallet/balance', { sessionID, gameID });
  return data.balance;
}

export async function play({ amountApi, currency, mode = 'BASE' } = {}) {
  const { sessionID, gameID, currency: urlCurrency } = getRgsParams();
  return rgsPost('/wallet/play', {
    sessionID,
    gameID,
    amount: amountApi,
    currency: currency ?? getPlayerCurrency(urlCurrency),
    mode,
  });
}

export async function endRound() {
  const { sessionID, gameID } = getRgsParams();
  return rgsPost('/wallet/end-round', { sessionID, gameID });
}

/** Track book event progress for RGS resume (skipped in replay mode). */
export async function reportBetEvent(eventIndex) {
  if (isReplayModeConfig()) return;
  const { sessionID, gameID } = getRgsParams();
  return rgsPost('/bet/event', { sessionID, gameID, event: String(eventIndex) });
}

/** Player decision during an active round (skipped in replay mode). */
export async function reportBetAction(action, meta) {
  if (isReplayModeConfig()) return;
  const { sessionID, gameID } = getRgsParams();
  const body = { sessionID, gameID, action };
  if (meta) body.meta = meta;
  return rgsPost('/bet/action', body);
}

export { parseAuthResponse } from './suki/authConfig.js';
export { createControlPolicy } from './suki/controlPolicy.js';
export { applyProductionShell, rgsOfflineMessage } from './suki/productionUi.js';
export { withRgsCall } from './suki/rgsTransport.js';
export {
  bootstrapPlayMode,
  attachBalanceRefresh,
  createGameBootstrap,
  createSessionTimer,
  formatSessionElapsed,
  createCurrencyFormatter,
  formatCurrencyAmount,
  createCopyPolicy,
  applyCopyLabels,
  isSocialCasinoMode,
} from './suki/bootstrap.js';
export { setPlayerCurrency, getPlayerCurrency, clearPlayerCurrency } from './suki/playerCurrency.js';
export { createI18n, resolveLang, SUPPORTED_LOCALES } from './suki/i18n.js';
export {
  createBetModePolicy,
  normalizeModeKey,
  toRgsMode,
  parseGameModesFromIndex,
} from './suki/betModes.js';

/** @returns {{ game: string, version: string, mode: string, event: string, amountApi: number }} */
export function getReplayParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    game: params.get('game') || getGameId(),
    version: params.get('version') || getReplayVersion(),
    mode: (params.get('mode') || 'base').toLowerCase(),
    event: params.get('event') || '',
    amountApi: Number(params.get('amount')) || API_AMOUNT_MULTIPLIER,
  };
}

export function buildReplayUrl({ event, amountApi, mode = 'base' }) {
  const { rgsUrl } = getRgsParams();
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('replay', 'true');
  url.searchParams.set('rgs_url', rgsUrl);
  url.searchParams.set('game', getGameId());
  url.searchParams.set('version', getReplayVersion());
  url.searchParams.set('mode', mode.toLowerCase());
  url.searchParams.set('event', event);
  url.searchParams.set('amount', String(amountApi));
  return url.toString();
}

export async function requestReplay({ game, version, mode, event, amountApi }) {
  const { rgsUrl } = getRgsParams();
  const modePath = mode.toLowerCase();
  const amountQuery = amountApi ? `?amount=${amountApi}` : '';
  const response = await fetch(
    `${rgsUrl}/bet/replay/${game}/${version}/${modePath}/${encodeURIComponent(event)}${amountQuery}`,
  );
  const data = await response.json();
  if (!response.ok || data.error) {
    const code = data.error?.code || `HTTP_${response.status}`;
    throw new Error(code);
  }
  return data;
}

/** Book payout int (×100) → Stake float multiplier on round. */
export function roundPayoutMultiplier(round) {
  if (typeof round.payoutMultiplier === 'number') return round.payoutMultiplier;
  return (round.payout ?? 0) / Math.max(1, round.amount ?? 1);
}
