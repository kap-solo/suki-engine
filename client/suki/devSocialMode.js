/**
 * Dev-only social casino preview — session override + ?social=true URL sync.
 */

import { isDevMode } from './config.js';

export const DEV_SOCIAL_CASINO_STORAGE_KEY = 'suki.dev.socialCasino';

/**
 * @returns {boolean | null} — null when not set (dev only).
 */
export function getDevSocialCasinoOverride() {
  if (!isDevMode() || typeof sessionStorage === 'undefined') return null;
  const stored = sessionStorage.getItem(DEV_SOCIAL_CASINO_STORAGE_KEY);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return null;
}

/** @param {boolean} enabled */
export function setDevSocialCasinoOverride(enabled) {
  if (!isDevMode() || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(DEV_SOCIAL_CASINO_STORAGE_KEY, enabled ? 'true' : 'false');
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set('social', 'true');
  else url.searchParams.delete('social');
  history.replaceState(null, '', url);
}

export function clearDevSocialCasinoOverride() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(DEV_SOCIAL_CASINO_STORAGE_KEY);
}

/**
 * Pure resolver for tests and isSocialCasinoMode().
 *
 * @param {{ jurisdictionSocial?: boolean, devOverride?: boolean | null, urlSocial?: boolean, devMode?: boolean }} [signals]
 */
export function resolveSocialCasinoMode({
  jurisdictionSocial = false,
  devOverride = null,
  urlSocial = false,
  devMode = false,
} = {}) {
  if (devMode) {
    if (devOverride === true) return true;
    if (devOverride === false) return false;
    if (urlSocial) return true;
  }
  return !!jurisdictionSocial;
}

function readDevSocialCasinoSignals() {
  const devMode = isDevMode();
  const devOverride = getDevSocialCasinoOverride();
  const urlSocial =
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('social') === 'true';
  return { devMode, devOverride, urlSocial };
}

/**
 * @param {{ socialCasino?: boolean } | null | undefined} jurisdictionState
 */
export function isDevSocialCasinoActive(jurisdictionState) {
  const { devMode, devOverride, urlSocial } = readDevSocialCasinoSignals();
  return resolveSocialCasinoMode({
    jurisdictionSocial: !!jurisdictionState?.socialCasino,
    devOverride,
    urlSocial,
    devMode,
  });
}

/**
 * Flip dev social preview and persist override + URL param.
 *
 * @param {{ socialCasino?: boolean } | null | undefined} jurisdictionState
 * @returns {boolean} — new social mode state
 */
export function toggleDevSocialCasinoMode(jurisdictionState) {
  if (!isDevMode()) return false;
  const next = !isDevSocialCasinoActive(jurisdictionState);
  setDevSocialCasinoOverride(next);
  return next;
}
