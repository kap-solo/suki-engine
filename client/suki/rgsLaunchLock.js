import { isStakeLaunch } from './environment.js';
import { formatRgsUrlParam, normalizeRgsBase } from './rgsConfig.js';

/** Raw `rgs_url` query value captured when the page first loaded. */
const launchRgsUrlParam =
  typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('rgs_url')?.trim() ?? '')
    : '';

/**
 * @param {import('./environment.js').SukiEnvironment} environment
 */
export function shouldEnforceLaunchRgsLock(environment) {
  if (environment === 'production' || environment === 'sandbox') return true;
  if (environment === 'development' && isStakeLaunch()) return true;
  return false;
}

/**
 * @param {URLSearchParams | string} params
 */
function readRgsUrlParam(params) {
  if (typeof params === 'string') {
    return new URLSearchParams(params).get('rgs_url')?.trim() ?? '';
  }
  return params.get('rgs_url')?.trim() ?? '';
}

/**
 * @param {string} launchRaw
 * @param {string} currentRaw
 * @param {string} [origin]
 */
export function hasRgsUrlParamChanged(launchRaw, currentRaw, origin = 'http://127.0.0.1') {
  const launch = String(launchRaw ?? '').trim();
  const current = String(currentRaw ?? '').trim();
  if (!launch) return false;
  if (!current) return true;
  const launchHost = formatRgsUrlParam(normalizeRgsBase(launch, origin));
  const currentHost = formatRgsUrlParam(normalizeRgsBase(current, origin));
  return launchHost !== currentHost;
}

export function getLaunchRgsUrlParam() {
  return launchRgsUrlParam;
}

export function getCurrentRgsUrlParam() {
  if (typeof window === 'undefined') return '';
  return readRgsUrlParam(new URLSearchParams(window.location.search));
}

export function hasRgsUrlChangedSinceLaunch() {
  if (typeof window === 'undefined') return false;
  return hasRgsUrlParamChanged(
    launchRgsUrlParam,
    getCurrentRgsUrlParam(),
    window.location.origin,
  );
}

/**
 * @param {import('./environment.js').SukiEnvironment} environment
 */
export function validateLaunchRgsUrlStable(environment) {
  if (!shouldEnforceLaunchRgsLock(environment)) {
    return { ok: true };
  }
  if (!launchRgsUrlParam) {
    return { ok: true };
  }
  if (hasRgsUrlChangedSinceLaunch()) {
    return { ok: false };
  }
  return { ok: true };
}
