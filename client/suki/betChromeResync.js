/**
 * Resync bet chrome after tab idle / viewport changes (autoplay visibility, layout).
 */

const DEFAULT_RESYNC_DELAYS_MS = [300, 1000, 3000];

/**
 * @param {object} options
 * @param {() => void} options.onResync
 * @param {number[]} [options.delayMs]
 * @param {() => void} [options.onVisible]
 */
export function attachBetChromeResync(options) {
  const { onResync, delayMs = DEFAULT_RESYNC_DELAYS_MS, onVisible } = options;
  /** @type {number[]} */
  const timers = [];

  function clearTimers() {
    for (const id of timers) {
      clearTimeout(id);
    }
    timers.length = 0;
  }

  function resync() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    onResync();
    requestAnimationFrame(onResync);
    clearTimers();
    for (const ms of delayMs) {
      timers.push(window.setTimeout(onResync, ms));
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    resync();
    onVisible?.();
  }

  function onFocus() {
    if (document.visibilityState !== 'visible') return;
    resync();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pageshow', resync);

  return {
    resync,
    destroy() {
      clearTimers();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', resync);
    },
  };
}

export { DEFAULT_RESYNC_DELAYS_MS as BET_CHROME_RESYNC_DELAYS_MS };
