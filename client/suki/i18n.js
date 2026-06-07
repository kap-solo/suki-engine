import { getLocalePack, resolveLang, SUPPORTED_LOCALES } from './strings/index.js';
import { en } from './strings/en.js';

/**
 * @typedef {keyof typeof en} I18nKey
 */

/**
 * @param {object} [options]
 * @param {string} [options.lang] — Stake `lang` URL param / authenticate language
 * @param {boolean} [options.socialCasino]
 * @param {Partial<Record<I18nKey, string>>} [options.overrides] — per-game or per-auth tweaks
 */
export function createI18n(options = {}) {
  const { lang = 'en', socialCasino = false, overrides = {} } = options;
  const resolved = resolveLang(lang);
  const pack = getLocalePack(resolved);

  /**
   * @param {I18nKey | string} key
   * @param {Record<string, string | number>} [vars] — simple `{name}` interpolation
   */
  function t(key, vars) {
    const socialText = socialCasino ? pack.social[key] : undefined;
    let text = overrides[key] ?? socialText ?? pack.strings[key] ?? en[key] ?? key;

    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  }

  return {
    lang: resolved,
    socialCasino,
    t,
    /** Alias for copy.policy compatibility */
    term: t,
    /** All resolved strings for the active mode (debug / compliance footer). */
    exportTerms() {
      const keys = new Set([...Object.keys(en), ...Object.keys(overrides)]);
      const out = {};
      for (const key of keys) {
        out[key] = t(key);
      }
      return out;
    },
  };
}

export { resolveLang, SUPPORTED_LOCALES };
