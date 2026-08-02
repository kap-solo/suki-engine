/**
 * RGS connection config — Stake iframe params, URL normalization, environment guards.
 *
 * Stake passes rgs_url as host-only (no scheme), e.g. rgs_url=rgs.example.com
 */

import { readLaunchSearchParams } from './launchParams.js';

/** @typedef {'production' | 'sandbox' | 'development' | 'hostedDemo' | 'replay'} RgsEnvironment */

/**
 * @param {string} urlOrHost
 * @param {string} [fallbackOrigin]
 * @returns {string}
 */
export function normalizeRgsBase(urlOrHost, fallbackOrigin = '') {
  const raw = String(urlOrHost || '').trim();
  if (!raw) {
    return String(fallbackOrigin || '').replace(/\/$/, '');
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/$/, '');
  }
  const hostOnly = raw.replace(/\/$/, '');
  if (isLocalRgsUrl(`http://${hostOnly}`)) {
    return `http://${hostOnly}`;
  }
  return `https://${hostOnly}`;
}

/**
 * Stake passes host-only rgs_url in launch/replay URLs (no scheme).
 * @param {string} rgsUrl — normalized base from buildRgsConfig
 */
export function formatRgsUrlParam(rgsUrl) {
  const raw = String(rgsUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).host;
    } catch {
      return raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  }
  return raw.replace(/\/$/, '');
}

/**
 * Build absolute RGS endpoint — always use rgsUrl from launch params, never page origin.
 * @param {string} rgsUrl
 * @param {string} path — e.g. /wallet/authenticate
 */
export function resolveRgsEndpoint(rgsUrl, path) {
  const base = String(rgsUrl || '').replace(/\/$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${base}${route}`;
}

/**
 * @param {string} rgsUrl — full base URL
 */
export function isLocalRgsUrl(rgsUrl) {
  try {
    const { hostname } = new URL(rgsUrl);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local')
    );
  } catch {
    return true;
  }
}

/**
 * @param {object} options
 * @param {URLSearchParams | Record<string, string>} [options.searchParams]
 * @param {string} [options.origin]
 * @param {string} options.gameId
 * @param {string} [options.storedSessionID]
 * @returns {{
 *   rgsUrl: string,
 *   rgsUrlHost: string,
 *   rgsUrlExplicit: boolean,
 *   sessionID: string,
 *   language: string,
 *   gameID: string,
 *   currency: string,
 * }}
 */
export function buildRgsConfig(options) {
  const params = options.searchParams ?? readSearchParams();
  const get = (key) => (typeof params.get === 'function' ? params.get(key) : params[key]) ?? '';

  const rgsUrlRaw = get('rgs_url');
  const origin = options.origin ?? readOrigin();
  const rgsUrl = normalizeRgsBase(rgsUrlRaw, origin);

  const sessionFromUrl = get('sessionID');
  const sessionID = sessionFromUrl || options.storedSessionID || 'local-demo';
  const language = get('lang') || 'en';
  const gameID = get('gameID') || options.gameId;
  const currency = get('currency') || 'USD';

  return {
    rgsUrl,
    rgsUrlHost: formatRgsUrlParam(rgsUrl),
    rgsUrlExplicit: Boolean(rgsUrlRaw?.trim()),
    sessionID,
    language,
    gameID,
    currency,
  };
}

/**
 * @param {ReturnType<typeof buildRgsConfig>} config
 * @param {RgsEnvironment} environment
 * @returns {{ ok: boolean, issues: string[], warnings: string[] }}
 */
export function validateRgsConfig(config, environment) {
  const issues = [];
  const warnings = [];

  if (environment === 'replay') {
    return { ok: true, issues, warnings };
  }

  if (environment === 'production' || environment === 'sandbox') {
    if (!config.rgsUrlExplicit) {
      issues.push('rgs_url is required (Stake passes host-only, e.g. rgs_url=rgs.stake-engine.com)');
    } else {
      try {
        const parsed = new URL(config.rgsUrl);
        if (!parsed.hostname) {
          issues.push('rgs_url is not a valid host');
        }
      } catch {
        issues.push('rgs_url is not a valid URL');
      }
    }
    if (isLocalRgsUrl(config.rgsUrl)) {
      issues.push('local/mock RGS is not allowed — use Stake sandbox rgs_url');
    }
    if (!config.sessionID || config.sessionID === 'local-demo') {
      issues.push('sessionID is required from the Stake launch URL');
    }
  }

  if (environment === 'production') {
    if (!config.rgsUrlExplicit) {
      issues.push('production requires explicit rgs_url from operator iframe');
    }
  }

  if (environment === 'development') {
    if (!config.rgsUrlExplicit && isLocalRgsUrl(config.rgsUrl)) {
      warnings.push('using local mock RGS — add ?sandbox=true and rgs_url for Stake sandbox');
    }
  }

  return { ok: issues.length === 0, issues, warnings };
}

/** @param {RgsEnvironment} environment */
export function describeRgsMode(environment) {
  switch (environment) {
    case 'sandbox':
      return 'Stake RGS sandbox';
    case 'development':
      return 'local mock RGS';
    case 'replay':
      return 'replay';
    case 'hostedDemo':
      return 'hosted demo (mock RGS)';
    default:
      return 'Stake RGS production';
  }
}

function readSearchParams() {
  if (typeof window !== 'undefined') {
    return readLaunchSearchParams(window.location);
  }
  return new URLSearchParams();
}

function readOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://127.0.0.1';
}
