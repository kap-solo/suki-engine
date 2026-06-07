/**
 * UI control policy from jurisdiction controller — single place for gating.
 */

/**
 * @param {ReturnType<import('./jurisdiction.js').createJurisdictionController>} jurisdiction
 */
export function createControlPolicy(jurisdiction) {
  return {
    get canTurbo() {
      return jurisdiction.turboAllowed;
    },
    get canSuperTurbo() {
      return !jurisdiction.state.disabledSuperTurbo;
    },
    get canAutoplay() {
      return jurisdiction.autoplayAllowed;
    },
    get canSpacebar() {
      return jurisdiction.spacebarAllowed;
    },
    get canSlamstop() {
      return !jurisdiction.state.disabledSlamstop;
    },
    get canBuyFeature() {
      return !jurisdiction.state.disabledBuyFeature;
    },
    get canFullscreen() {
      return !jurisdiction.state.disabledFullscreen;
    },
    get showNetPosition() {
      return jurisdiction.showNetPosition;
    },
    get showRtp() {
      return jurisdiction.showRtp;
    },
    get showSessionTimer() {
      return jurisdiction.state.displaySessionTimer;
    },
    get minRoundDurationMs() {
      return jurisdiction.minRoundDurationMs;
    },
    get isSocialCasino() {
      return !!jurisdiction.state.socialCasino;
    },

    /**
     * @param {HTMLElement | null} el
     * @param {boolean} allowed
     */
    setVisible(el, allowed) {
      if (el) el.hidden = !allowed;
    },

    /**
     * @param {HTMLElement | null} el
     * @param {boolean} enabled
     */
    setEnabled(el, enabled) {
      if (el) el.disabled = !enabled;
    },

    /**
     * @param {HTMLButtonElement[]} elements
     * @param {boolean} enabled
     */
    setButtonsEnabled(elements, enabled) {
      for (const el of elements) {
        if (el) el.disabled = !enabled;
      }
    },
  };
}
