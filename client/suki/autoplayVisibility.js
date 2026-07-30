/**
 * Autoplay panel visibility — hide only on settled jurisdiction, not transient sync.
 */

import { isDevMode } from './config.js';
import { showDevTools } from './environment.js';

/**
 * @param {object} options
 * @param {() => boolean} options.getCanAutoplay — createControlPolicy().canAutoplay
 * @param {() => boolean} [options.getReplayMode]
 */
export function createAutoplayPanelPolicy(options) {
  const getReplayMode = options.getReplayMode ?? (() => false);
  let hiddenByJurisdiction = false;

  function sync() {
    hiddenByJurisdiction = !getReplayMode()
      && !isDevMode()
      && !showDevTools()
      && !options.getCanAutoplay();
  }

  /**
   * @param {object} ctx
   * @param {boolean} ctx.autoplaying
   * @param {boolean} [ctx.replayMode]
   */
  function isPanelVisible(ctx) {
    if (ctx.replayMode ?? getReplayMode()) return false;
    if (ctx.autoplaying) return true;
    if (isDevMode() || showDevTools()) return true;
    return !hiddenByJurisdiction;
  }

  return {
    sync,
    isPanelVisible,
    get hiddenByJurisdiction() {
      return hiddenByJurisdiction;
    },
  };
}

/**
 * Do not hide autoplay chrome while the tab is backgrounded (avoids stale hidden on return).
 *
 * @param {object} options
 * @param {HTMLElement | null | undefined} options.root — button or cluster root
 * @param {HTMLElement | null | undefined} [options.panel]
 * @param {boolean} options.replayChrome
 * @param {boolean} options.autoplaying
 * @param {boolean} options.stopPending
 * @param {boolean} options.visible
 */
export function syncAutoplayChromeHidden(options) {
  const { root, panel, replayChrome, autoplaying, stopPending, visible } = options;
  if (!root) return;

  if (replayChrome) {
    root.hidden = true;
    if (panel) panel.hidden = true;
    return;
  }

  const show = autoplaying || stopPending || visible;
  if (show) {
    root.hidden = false;
    if (panel) panel.hidden = false;
  } else if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
    root.hidden = true;
    if (panel) panel.hidden = true;
  }
}
