/** Per-game identifiers and URL-driven test flags. */

/** @type {{ gameId: string, replayVersion: string, sessionStorageKey: string }} */
let engineConfig = {
  gameId: 'unknown',
  replayVersion: '1',
  sessionStorageKey: 'suki.rgsSessionID',
};

/**
 * Call once at game startup before any RGS calls.
 * @param {{ gameId: string, replayVersion?: string, sessionStorageKey?: string }} config
 */
export function initSuki(config) {
  engineConfig = {
    ...engineConfig,
    ...config,
    replayVersion: config.replayVersion ?? engineConfig.replayVersion,
    sessionStorageKey: config.sessionStorageKey ?? engineConfig.sessionStorageKey,
  };
}

export function getSukiConfig() {
  return { ...engineConfig };
}

export function getGameId() {
  return engineConfig.gameId;
}

export function getReplayVersion() {
  return engineConfig.replayVersion;
}

export function getSessionStorageKey() {
  return engineConfig.sessionStorageKey;
}

export function isDevMode() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('dev') === 'true';
}

/** Stake RGS sandbox — real remote RGS with ?sandbox=true (not local mock). */
export function isSandboxMode() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('sandbox') === 'true';
}

export function isReplayMode() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('replay') === 'true';
}

/** Dev-only mock flags sent to prototype RGS (ignored in production Stake). */
export function getMockFlags() {
  if (!isDevMode()) return null;
  const params = new URLSearchParams(window.location.search);
  const flags = {};
  const jurisdiction = params.get('jurisdiction');
  if (jurisdiction) flags.jurisdiction = jurisdiction;
  if (params.get('mock_err_is') === 'true') flags.err_is = true;
  const currency = params.get('currency');
  if (currency) flags.currency = currency;
  return Object.keys(flags).length ? flags : null;
}

export function getJurisdictionProfileName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('jurisdiction') || 'server';
}

export function getDevComplianceLabel() {
  const mock = getMockFlags();
  const parts = [];
  if (isSandboxMode()) parts.push('sandbox RGS');
  else if (isDevMode()) parts.push('dev mock RGS');
  parts.push(`jurisdiction: ${getJurisdictionProfileName()}`);
  if (mock?.err_is) parts.push('mock ERR_IS');
  return parts.join(' · ');
}
