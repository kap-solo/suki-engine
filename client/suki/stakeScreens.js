/**
 * Stake Engine iframe "screens" — fixed QA viewports from the provider setup.
 *
 * Landscape sizes are CSS pixels. Mobile sizes in Stake Engine are physical
 * pixels at 3× DPR — we use logical (÷3) dimensions for the dev preview frame
 * so browser testing matches iframe layout width/height.
 */

/** @typedef {object} StakeScreen
 * @property {string} id — URL param value (?screen=desktop)
 * @property {string} label — toolbar display name
 * @property {number} width — CSS/logical pixels (dev preview frame)
 * @property {number} height
 * @property {number} [stakeWidth] — physical pixels in Stake Engine setup
 * @property {number} [stakeHeight]
 * @property {number} [devicePixelRatio=1]
 * @property {'landscape' | 'portrait'} [orientation]
 */

/** @param {number} stakeWidth @param {number} stakeHeight @param {number} [dpr=3] */
function mobileScreen(id, label, stakeWidth, stakeHeight, dpr = 3) {
  return {
    id,
    label,
    width: Math.round(stakeWidth / dpr),
    height: Math.round(stakeHeight / dpr),
    stakeWidth,
    stakeHeight,
    devicePixelRatio: dpr,
    orientation: 'portrait',
  };
}

/** Default seven screens from Stake Engine setup. */
export const STAKE_SCREENS = [
  { id: 'desktop', label: 'Desktop', width: 1200, height: 675, orientation: 'landscape' },
  { id: 'laptop', label: 'Laptop', width: 1024, height: 576, orientation: 'landscape' },
  { id: 'popout-l', label: 'Popout L', width: 800, height: 450, orientation: 'landscape' },
  { id: 'popout-s', label: 'Popout S', width: 400, height: 225, orientation: 'landscape' },
  mobileScreen('mobile-l', 'Mobile L', 1275, 2436),
  mobileScreen('mobile-m', 'Mobile M', 1125, 2001),
  mobileScreen('mobile-s', 'Mobile S', 960, 1704),
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
