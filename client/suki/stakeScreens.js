/**
 * Stake Engine iframe "screens" — fixed QA viewports from the provider setup.
 * Games should lay out and test against these in dev (?dev=true).
 */

/** @typedef {object} StakeScreen
 * @property {string} id — URL param value (?screen=desktop)
 * @property {string} label — toolbar display name
 * @property {number} width
 * @property {number} height
 * @property {'landscape' | 'portrait'} [orientation]
 */

/** Default seven screens from Stake Engine setup. */
export const STAKE_SCREENS = [
  { id: 'desktop', label: 'Desktop', width: 1200, height: 675, orientation: 'landscape' },
  { id: 'laptop', label: 'Laptop', width: 1024, height: 576, orientation: 'landscape' },
  { id: 'popout-l', label: 'Popout L', width: 800, height: 450, orientation: 'landscape' },
  { id: 'popout-s', label: 'Popout S', width: 400, height: 225, orientation: 'landscape' },
  { id: 'mobile-l', label: 'Mobile L', width: 1275, height: 2436, orientation: 'portrait' },
  { id: 'mobile-m', label: 'Mobile M', width: 1125, height: 2001, orientation: 'portrait' },
  { id: 'mobile-s', label: 'Mobile S', width: 960, height: 1704, orientation: 'portrait' },
];

/**
 * @param {StakeScreen[]} [extraScreens] — append or override by id
 */
export function createScreenRegistry(extraScreens = []) {
  /** @type {Map<string, StakeScreen>} */
  const byId = new Map(STAKE_SCREENS.map((s) => [s.id, s]));
  for (const screen of extraScreens) {
    byId.set(screen.id, screen);
  }
  const screens = [...byId.values()];

  return {
    screens,
    /** @param {string} id */
    get(id) {
      return byId.get(String(id || '').trim().toLowerCase()) ?? null;
    },
    /** @param {string | URLSearchParams} [search] */
    resolveIdFromUrl(search) {
      const params =
        typeof search === 'string'
          ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
          : search instanceof URLSearchParams
            ? search
            : new URLSearchParams(window.location.search);
      const id = params.get('screen')?.trim().toLowerCase();
      if (!id) return null;
      return byId.has(id) ? id : null;
    },
  };
}
