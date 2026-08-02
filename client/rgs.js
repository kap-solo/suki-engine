import { API_AMOUNT_MULTIPLIER } from './money.js';
import {
  getGameId,
  getReplayVersion,
  getSessionStorageKey,
  isReplayMode as isReplayModeConfig,
  getMockFlags,
} from './suki/config.js';
import { messageForRgsCode } from './suki/errors.js';
import { buildRgsConfig, describeRgsMode, formatRgsUrlParam, resolveRgsEndpoint } from './suki/rgsConfig.js';
import { getEnvironment } from './suki/environment.js';
import { getPlayerCurrency } from './suki/playerCurrency.js';
import { withRgsCall } from './suki/rgsTransport.js';
import { ERR_RGS_CONFIG } from './suki/rgsGate.js';
import { validateLaunchRgsUrlStable } from './suki/rgsLaunchLock.js';
import {
  readLaunchEventId,
  readLaunchSearchParams,
  normalizeStakeLaunchAliases,
} from './suki/launchParams.js';
import {
  isConnectionFailure,
  notifyRgsConnectionLost,
  notifyRgsConnectionRestored,
} from './suki/rgsConnection.js';

export { initSuki, getSukiConfig, getDevComplianceLabel, getJurisdictionProfileName } from './suki/config.js';
export { messageForRgsCode, classifyRgsError, applyRgsError, isSessionFatal } from './suki/errors.js';
export {
  getEnvironment,
  isProduction,
  isDevelopment,
  isReplayEnvironment,
  isSandboxEnvironment,
  isHostedDemoEnvironment,
  isHostedDemoMode,
  isStakeLaunch,
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
  formatRgsUrlParam,
  resolveRgsEndpoint,
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
  const environment = getEnvironment();
  if (!validateLaunchRgsUrlStable(environment).ok) {
    throw new Error(ERR_RGS_CONFIG);
  }
  return buildRgsConfig({
    gameId: getGameId(),
    storedSessionID: getSessionID(),
    origin: window.location.origin,
    searchParams: new URLSearchParams(window.location.search),
  });
}

/** Resolved fetch URL for an RGS path — reads rgs_url from the launch URL on each call. */
export function getRgsEndpoint(path) {
  const { rgsUrl } = getRgsParams();
  return resolveRgsEndpoint(rgsUrl, path);
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

async function rgsPostOnce(path, body) {
  const endpoint = getRgsEndpoint(path);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('ERR_NET');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('ERR_NET');
  }

  if (!response.ok || data.error) {
    const code = data.error?.code || data.error?.statusCode || `HTTP_${response.status}`;
    throw new Error(code);
  }
  return data;
}

async function rgsPost(path, body) {
  try {
    const data = await withRgsCall(() => rgsPostOnce(path, body));
    notifyRgsConnectionRestored();
    return data;
  } catch (err) {
    const code = String(err?.message ?? 'ERR_GEN');
    if (isConnectionFailure(code)) {
      notifyRgsConnectionLost(code);
    }
    throw err;
  }
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
export {
  applyAuthBetConfig,
  applyAuthRoundBetOverride,
  buildBetLevelsApi,
  clampBetApi,
  createBetConfigPolicy,
  hasAuthBetConfig,
} from './suki/betConfig.js';
export { createControlPolicy } from './suki/controlPolicy.js';
export { applyProductionShell, rgsOfflineMessage } from './suki/productionUi.js';
export { withRgsCall } from './suki/rgsTransport.js';
export {
  setRgsConnectionCallbacks,
  isConnectionFailure,
  notifyRgsConnectionLost,
  notifyRgsConnectionRestored,
} from './suki/rgsConnection.js';
export { createConnectionBanner } from './suki/connectionBanner.js';
export {
  bootstrapPlayMode,
  attachBalanceRefresh,
  createGameBootstrap,
  createSessionTimer,
  formatSessionElapsed,
  createCurrencyFormatter,
  formatBalanceAmount,
  formatCurrencyAmount,
  formatWinAmount,
  formatWinDecimalString,
  STAKE_MONEY_DECIMALS,
  createCopyPolicy,
  applyCopyLabels,
  isSocialCasinoMode,
  isSocialCasino,
  pickSocialCopy,
  DEV_SOCIAL_CASINO_STORAGE_KEY,
  getDevSocialCasinoOverride,
  setDevSocialCasinoOverride,
  clearDevSocialCasinoOverride,
  resolveSocialCasinoMode,
  toggleDevSocialCasinoMode,
  isDevSocialCasinoActive,
  ensureDevToolbarStyles,
  createDevToolbarShell,
  mountDevSocialModeToggle,
} from './suki/bootstrap.js';
export { setPlayerCurrency, getPlayerCurrency, clearPlayerCurrency } from './suki/playerCurrency.js';
export { createI18n, resolveLang, SUPPORTED_LOCALES } from './suki/i18n.js';
export {
  createBetModePolicy,
  applyBetModeFromRound,
  normalizeModeKey,
  toRgsMode,
  parseGameModesFromIndex,
} from './suki/betModes.js';
export {
  STAKE_SCREENS,
  createScreenRegistry,
  initStakeScreenPreview,
} from './suki/screenPreview.js';
export {
  STAKE_LAYOUT_REF,
  STAKE_CORE_ASPECT,
  PORTRAIT_FAMILY,
  applyStakeScreenContext,
  initStakeLayout,
  resolveOrientation,
  resolvePortraitFamily,
} from './suki/stakeLayout.js';
export {
  createShellClock,
  formatShellClockTime,
} from './suki/shellClock.js';
export {
  createBetUi,
  modeButtonLabel,
  resolvePlayButtonState,
} from './suki/betUi.js';
export {
  createAudioPrefs,
} from './suki/audioPrefs.js';
export {
  createGameAudio,
} from './suki/gameAudio.js';
export {
  getSfxBus,
  resumeGameSfxContext,
} from './suki/sfxBus.js';
export {
  createGamePreloader,
} from './suki/gamePreloader.js';
export {
  createAssetLoader,
  preloadAssets,
} from './suki/assetLoader.js';
export {
  SPINE_TEXTURE_CANVAS_SIZE,
  SPINE_SYMBOL_FIT_RATIO,
} from './suki/spineAssets.js';
export {
  createRecentResultsStore,
} from './suki/recentResults.js';
export {
  createModalHost,
} from './suki/modalHost.js';
export {
  registerAutoplayConfirm,
  AUTOPLAY_CONFIRM_MODAL_ID,
  DEFAULT_AUTOPLAY_ROUNDS,
  AUTOPLAY_MIN_ROUNDS,
  AUTOPLAY_MAX_ROUNDS,
  parseAutoplayRoundCount,
  sanitizeAutoplayRoundDigits,
  shouldBlockAutoplayRoundKey,
} from './suki/autoplayConfirm.js';
export {
  registerBuyBonusConfirm,
  BUY_BONUS_CONFIRM_MODAL_ID,
} from './suki/buyBonusConfirm.js';
export {
  createGameMenu,
  DEFAULT_GAME_MENU_ITEMS,
  filterVisibleMenuItems,
  resolveGameMenuItems,
} from './suki/gameMenu.js';
export {
  readLaunchSearchParams,
  readLaunchEventId,
  normalizeStakeLaunchAliases,
  detectReplayLaunch,
  syncLaunchParamsFromHash,
} from './suki/launchParams.js';
export { appendGeneralDisclaimer } from './suki/gameInfo.js';

/** @returns {{ game: string, version: string, mode: string, event: string, amountApi: number }} */
export function getReplayParams() {
  const params = readLaunchSearchParams(window.location);
  normalizeStakeLaunchAliases(params);
  return {
    game: params.get('game') || getGameId(),
    version: params.get('version') || getReplayVersion(),
    mode: (params.get('mode') || 'base').toLowerCase(),
    event: readLaunchEventId(params),
    amountApi: Number(params.get('amount')) || API_AMOUNT_MULTIPLIER,
  };
}

/**
 * Stake RGS replay may return { round } or a flat { state, payoutMultiplier, costMultiplier }.
 * @param {object} data
 * @param {ReturnType<typeof getReplayParams>} launchParams
 * @param {{ resolvePayout?: (amountApi: number, payoutMultiplier: number, mode: string) => number }} [options]
 */
export function normalizeReplayRound(data, launchParams, options = {}) {
  if (!data || typeof data !== 'object') {
    throw new Error('ERR_BNF');
  }

  const source = data.round && typeof data.round === 'object' ? data.round : data;
  const mode = String(source.mode ?? launchParams.mode ?? 'base').toUpperCase();
  const amountApi = Number(source.amount ?? launchParams.amountApi);
  if (!Number.isFinite(amountApi) || amountApi <= 0) {
    throw new Error('ERR_VAL');
  }

  const state = source.state ?? data.state ?? [];
  if (!Array.isArray(state) || state.length === 0) {
    throw new Error('ERR_BNF');
  }

  const payoutMultiplier = typeof source.payoutMultiplier === 'number'
    ? source.payoutMultiplier
    : typeof data.payoutMultiplier === 'number'
      ? data.payoutMultiplier
      : undefined;

  let payout = source.payout;
  if (payout == null && payoutMultiplier != null) {
    payout = options.resolvePayout
      ? options.resolvePayout(amountApi, payoutMultiplier, mode)
      : Math.round(amountApi * payoutMultiplier);
  }

  const round = {
    ...source,
    amount: amountApi,
    mode,
    state,
    payout: payout ?? 0,
    active: false,
    roundID: source.roundID ?? source.betID ?? launchParams.event,
  };

  if (payoutMultiplier != null) {
    round.payoutMultiplier = payoutMultiplier;
  }

  return round;
}

export function buildReplayUrl({ event, amountApi, mode = 'base', lang } = {}) {
  const { rgsUrl, rgsUrlHost, language } = getRgsParams();
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('replay', 'true');
  url.searchParams.set('rgs_url', rgsUrlHost || formatRgsUrlParam(rgsUrl));
  url.searchParams.set('game', getGameId());
  url.searchParams.set('version', getReplayVersion());
  url.searchParams.set('mode', mode.toLowerCase());
  url.searchParams.set('event', event);
  url.searchParams.set('amount', String(amountApi));
  url.searchParams.set('lang', lang ?? language);
  return url.toString();
}

export async function requestReplay({ game, version, mode, event, amountApi }) {
  const modePath = mode.toLowerCase();
  const amountQuery = amountApi ? `?amount=${amountApi}` : '';
  const endpoint = getRgsEndpoint(
    `/bet/replay/${game}/${version}/${modePath}/${encodeURIComponent(event)}${amountQuery}`,
  );
  let response;
  try {
    response = await fetch(endpoint);
  } catch {
    throw new Error('ERR_NET');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('ERR_NET');
  }
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

export { shouldSkipBetEventReporting, shouldSkipEndRound } from './suki/roundReporting.js';
export { canAffordPlayAmount, assertSufficientBalanceForPlay } from './suki/balanceGuard.js';
export {
  formatReplayStartSummary,
  applyReplayModeChrome,
  resolveReplayBaseBetApi,
  resolveReplayBaseBetDisplay,
  formatReplaySummaryMultiplier,
  replaySettlementMultiplier,
  formatReplayPayoutMultiplier,
} from './suki/replayUi.js';
export {
  ERR_RGS_CONFIG,
  checkRgsGate,
  createFatalRgsError,
  isFatalRgsError,
  shouldTreatAuthFailureAsInvalidRgs,
} from './suki/rgsGate.js';
export { applyMobileTouchPolicy, SUKI_VIEWPORT_CONTENT } from './suki/mobileTouch.js';
export {
  createAutoplayController,
  AUTOPLAY_STOP_LABEL,
} from './suki/autoplay.js';
export {
  createAutoplayPanelPolicy,
  syncAutoplayChromeHidden,
} from './suki/autoplayVisibility.js';
export {
  flashAutoplayStopClick,
  syncAutoplayBetControl,
} from './suki/betChromeAutoplay.js';
export {
  attachBetChromeResync,
  BET_CHROME_RESYNC_DELAYS_MS,
} from './suki/betChromeResync.js';
export {
  readViewportSize,
  isPopoutSSize,
  inferPopoutSScreen,
  inferPopoutSFromRoot,
  applyInferredStakeScreen,
  schedulePopoutSInference,
  patchStakeLayoutForProduction,
  isPopoutSViewport,
} from './suki/stakeScreenInfer.js';
export {
  getLaunchRgsUrlParam,
  getCurrentRgsUrlParam,
  hasRgsUrlChangedSinceLaunch,
  hasRgsUrlParamChanged,
  shouldEnforceLaunchRgsLock,
  validateLaunchRgsUrlStable,
} from './suki/rgsLaunchLock.js';
