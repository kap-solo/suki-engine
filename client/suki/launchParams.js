/**
 * Stake launch / replay URL params — query + hash merge and ACP previewer aliases.
 *
 * Stake ACP replay preview may omit ?replay=true, use eventId instead of event,
 * put params in the hash, or return a flat replay payload without data.round.
 */

/** @param {Pick<Location, 'search' | 'hash'>} location */
export function readLaunchSearchParams(location) {
  const merged = new URLSearchParams(location.search);
  const hash = String(location.hash || '').replace(/^#\??/, '');
  if (!hash) return merged;
  for (const [key, value] of new URLSearchParams(hash)) {
    if (!merged.has(key)) merged.set(key, value);
  }
  return merged;
}

/** @param {URLSearchParams} params */
export function readLaunchEventId(params) {
  return params.get('event')?.trim() || params.get('eventId')?.trim() || '';
}

/** @param {URLSearchParams} params */
export function normalizeStakeLaunchAliases(params) {
  const event = readLaunchEventId(params);
  if (event && !params.get('event')) params.set('event', event);
  const lang = params.get('lang') || params.get('language');
  if (lang && !params.get('lang')) {
    params.set('lang', String(lang).split(/[-_]/)[0].toLowerCase());
  }
}

/** @param {URLSearchParams} params */
export function detectReplayLaunch(params) {
  normalizeStakeLaunchAliases(params);
  const replayFlag = params.get('replay');
  if (replayFlag === 'true' || replayFlag === '1') return true;
  const event = readLaunchEventId(params);
  const game = params.get('game')?.trim();
  const version = params.get('version')?.trim();
  return Boolean(event && game && version);
}

/** Promote hash launch params into the query string so RGS helpers see them. */
export function syncLaunchParamsFromHash(location = typeof window !== 'undefined' ? window.location : null) {
  if (!location || typeof history === 'undefined') return;
  const params = readLaunchSearchParams(location);
  normalizeStakeLaunchAliases(params);
  const url = new URL(location.href);
  let changed = false;
  for (const [key, value] of params) {
    if (url.searchParams.get(key) !== value) {
      url.searchParams.set(key, value);
      changed = true;
    }
  }
  if (changed || location.hash) {
    url.hash = '';
    history.replaceState(null, '', url);
  }
}

if (typeof window !== 'undefined') {
  syncLaunchParamsFromHash();
}
