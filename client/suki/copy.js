/**
 * UI copy policy — locale strings + social casino terminology.
 * Built on createI18n(); use game.t() or copy.term() in games.
 */

import { isDevMode } from './config.js';
import { createI18n } from './i18n.js';
import { en, enSocial } from './strings/en.js';

/** @typedef {keyof typeof en} CopyTerm */

/** @deprecated Use createI18n / game.t — kept for importers. */
export const REAL_MONEY_COPY = { ...en };

/** @deprecated Use createI18n with socialCasino — kept for importers. */
export const SOCIAL_CASINO_COPY = { ...en, ...enSocial };

/**
 * Dev override: ?social=true (Stake convention for social casino preview).
 * @param {{ socialCasino?: boolean } | null | undefined} jurisdictionState
 */
export function isSocialCasinoMode(jurisdictionState) {
  if (jurisdictionState?.socialCasino) return true;
  if (typeof window !== 'undefined' && isDevMode()) {
    return new URLSearchParams(window.location.search).get('social') === 'true';
  }
  return false;
}

/**
 * @param {object} options
 * @param {string} [options.lang]
 * @param {boolean} [options.socialCasino]
 * @param {Partial<typeof REAL_MONEY_COPY>} [options.overrides]
 */
export function createCopyPolicy(options = {}) {
  const { lang, socialCasino = false, overrides = {} } = options;
  const i18n = createI18n({ lang, socialCasino, overrides });

  return {
    get socialCasino() {
      return socialCasino;
    },
    get lang() {
      return i18n.lang;
    },
    get i18n() {
      return i18n;
    },
    get terms() {
      return i18n.exportTerms();
    },
    /** @param {CopyTerm} key */
    term(key) {
      return i18n.t(key);
    },
    /** @param {CopyTerm} key */
    t(key, vars) {
      return i18n.t(key, vars);
    },
  };
}

/**
 * Update static HUD labels from copy policy.
 *
 * @param {ReturnType<typeof createCopyPolicy>} copy
 * @param {Record<string, HTMLElement | null>} elements
 */
export function applyCopyLabels(copy, elements) {
  const map = {
    balanceLabel: 'balance',
    betLabel: 'bet',
    lastResultLabel: 'lastResult',
    sessionPlaysLabel: 'sessionPlays',
    sessionPlLabel: 'sessionPl',
    replayNote: 'replayNote',
  };

  for (const [elKey, termKey] of Object.entries(map)) {
    const el = elements[elKey];
    if (el) el.textContent = copy.term(/** @type {CopyTerm} */ (termKey));
  }

  if (elements.dropButton) {
    elements.dropButton.textContent = copy.term('drop');
  }
}
