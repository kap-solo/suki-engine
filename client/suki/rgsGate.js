/**
 * Fatal RGS connection gate — invalid launch params block the game from loading.
 */

import { isConnectionFailure } from './rgsConnection.js';
import { validateRgsConfig, buildRgsConfig } from './rgsConfig.js';
import { getEnvironment } from './environment.js';
import { isReplayMode, getGameId, getSessionStorageKey } from './config.js';
import { validateLaunchRgsUrlStable } from './rgsLaunchLock.js';

export const ERR_RGS_CONFIG = 'ERR_RGS_CONFIG';

function readLaunchRgsConfig() {
  const sessionKey = getSessionStorageKey();
  const storedSessionID =
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(sessionKey) : null;
  return buildRgsConfig({
    gameId: getGameId(),
    storedSessionID: storedSessionID || 'local-demo',
    origin: typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1',
    searchParams:
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams(),
  });
}

/**
 * @param {string} message — player-facing copy
 */
export function createFatalRgsError(message) {
  const err = new Error(ERR_RGS_CONFIG);
  err.fatalRgs = true;
  err.playerMessage = message;
  return err;
}

/** @param {unknown} err */
export function isFatalRgsError(err) {
  if (!err || typeof err !== 'object') return false;
  return Boolean(/** @type {{ fatalRgs?: boolean }} */ (err).fatalRgs)
    || String(/** @type {{ message?: string }} */ (err).message) === ERR_RGS_CONFIG;
}

/**
 * Auth/transport failure caused by a bad explicit rgs_url (production / sandbox).
 * @param {string} code
 * @param {import('./environment.js').SukiEnvironment} environment
 * @param {{ rgsUrlExplicit?: boolean }} config
 */
export function shouldTreatAuthFailureAsInvalidRgs(code, environment, config) {
  if (environment !== 'production' && environment !== 'sandbox') return false;
  if (!config.rgsUrlExplicit) return false;
  if (!validateLaunchRgsUrlStable(environment).ok) return true;
  if (code === ERR_RGS_CONFIG) return true;
  if (isConnectionFailure(code)) return true;
  return code.startsWith('HTTP_');
}

/**
 * Sync launch validation — run before preloader continues or game shell is shown.
 * @param {{ invalidRgsMessage: string, environment?: import('./environment.js').SukiEnvironment }} ctx
 */
export function checkRgsGate(ctx) {
  if (isReplayMode()) {
    return { ok: true, issues: [], warnings: [] };
  }

  const environment = ctx.environment ?? getEnvironment();
  const launchLock = validateLaunchRgsUrlStable(environment);
  if (!launchLock.ok) {
    return {
      ok: false,
      message: ctx.invalidRgsMessage,
      issues: ['rgs_url changed after launch'],
      warnings: [],
    };
  }

  const config = readLaunchRgsConfig();
  const validation = validateRgsConfig(config, environment);

  if (!validation.ok) {
    return {
      ok: false,
      message: ctx.invalidRgsMessage,
      issues: validation.issues,
      warnings: validation.warnings,
    };
  }

  return {
    ok: true,
    issues: validation.issues,
    warnings: validation.warnings,
  };
}
