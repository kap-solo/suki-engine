import { STAKE_SCREENS } from './stakeScreens.js';
import { createShellClock } from './shellClock.js';

/** Design reference — Mobile L logical CSS pixels (Stake 1275×2436 @3x). */
export const STAKE_LAYOUT_REF = STAKE_SCREENS.find((s) => s.id === 'mobile-l') ?? {
  id: 'mobile-l',
  width: 425,
  height: 812,
};

/** width / height for the centered game core (Mobile L proportions). */
export const STAKE_CORE_ASPECT = STAKE_LAYOUT_REF.width / STAKE_LAYOUT_REF.height;

/** height / width above this → portrait uses the tall Mobile L family. */
export const PORTRAIT_L_MIN_RATIO = 1.845;

export const PORTRAIT_FAMILY = {
  MOBILE_L: 'mobile-l',
  MOBILE_MS: 'mobile-ms',
};

/**
 * @param {import('./stakeScreens.js').StakeScreen | null | undefined} screen
 * @param {number} width
 * @param {number} height
 * @returns {'landscape' | 'portrait'}
 */
export function resolveOrientation(screen, width, height) {
  if (screen?.orientation) return screen.orientation;
  if (screen?.width && screen?.height) {
    return screen.width > screen.height ? 'landscape' : 'portrait';
  }
  return width > height ? 'landscape' : 'portrait';
}

/**
 * @param {import('./stakeScreens.js').StakeScreen | null | undefined} screen
 * @param {number} width
 * @param {number} height
 * @returns {'mobile-l' | 'mobile-ms' | ''}
 */
export function resolvePortraitFamily(screen, width, height) {
  if (screen?.id === 'mobile-l') return PORTRAIT_FAMILY.MOBILE_L;
  if (screen?.id === 'mobile-m' || screen?.id === 'mobile-s') return PORTRAIT_FAMILY.MOBILE_MS;
  if (screen?.orientation === 'landscape' || (screen?.width && screen.width > screen.height)) {
    return '';
  }
  const ratio = height / Math.max(width, 1);
  return ratio >= PORTRAIT_L_MIN_RATIO ? PORTRAIT_FAMILY.MOBILE_L : PORTRAIT_FAMILY.MOBILE_MS;
}

/**
 * Stamp Stake layout context on the game root for CSS and canvas sizing.
 *
 * @param {HTMLElement} root
 * @param {object} [context]
 * @param {import('./stakeScreens.js').StakeScreen | null} [context.screen]
 * @param {number} [context.width]
 * @param {number} [context.height]
 */
export function applyStakeScreenContext(root, context = {}) {
  if (!root) return;

  const { screen = null } = context;
  const rect = root.getBoundingClientRect();
  const width = Math.round(context.width ?? screen?.width ?? rect.width);
  const height = Math.round(context.height ?? screen?.height ?? rect.height);
  const orientation = resolveOrientation(screen, width, height);
  const portraitFamily =
    orientation === 'portrait' ? resolvePortraitFamily(screen, width, height) : '';

  root.dataset.sukiOrientation = orientation;
  root.dataset.sukiPortraitFamily = portraitFamily;
  root.dataset.sukiScreen = screen?.id ?? '';

  root.style.setProperty('--suki-vw', `${width}px`);
  root.style.setProperty('--suki-vh', `${height}px`);
  root.style.setProperty('--suki-core-aspect', String(STAKE_CORE_ASPECT));
  root.style.setProperty(
    '--suki-core-w',
    `${Math.max(1, Math.round(height * STAKE_CORE_ASPECT))}px`,
  );
  root.style.setProperty('--suki-ref-w', `${STAKE_LAYOUT_REF.width}px`);
  root.style.setProperty('--suki-ref-h', `${STAKE_LAYOUT_REF.height}px`);
}

/**
 * Keep layout context in sync with the active Stake screen (dev preview) or viewport.
 *
 * @param {object} options
 * @param {HTMLElement} options.root — game shell (`main.suki-stake-shell`)
 * @param {() => import('./stakeScreens.js').StakeScreen | null} [options.getActiveScreen]
 */
export function initStakeLayout(options) {
  const { root, getActiveScreen = () => null } = options;
  const shellClock = createShellClock({ root });

  function refresh() {
    const screen = getActiveScreen();
    applyStakeScreenContext(root, { screen });
  }

  window.addEventListener('resize', refresh);
  refresh();

  return {
    refresh,
    shellClock,
    destroy() {
      window.removeEventListener('resize', refresh);
      shellClock.destroy();
      delete root.dataset.sukiOrientation;
      delete root.dataset.sukiPortraitFamily;
      delete root.dataset.sukiScreen;
    },
  };
}
