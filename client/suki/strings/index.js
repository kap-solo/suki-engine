import { en, enSocial } from './en.js';
import { de, deSocial } from './de.js';

/** @typedef {import('./en.js').en extends infer T ? keyof T : never} StringKey */

/** Locales with full string tables shipped in Suki. */
export const SUPPORTED_LOCALES = ['en', 'de'];

/** @type {Record<string, { strings: Record<string, string>, social: Record<string, string> }>} */
const PACKS = {
  en: { strings: en, social: enSocial },
  de: { strings: de, social: deSocial },
};

/**
 * Normalise Stake lang param (e.g. en, de, pt-BR) to a supported locale code.
 * @param {string} [lang]
 */
export function resolveLang(lang) {
  const code = String(lang || 'en')
    .split(/[-_]/)[0]
    .toLowerCase();
  return SUPPORTED_LOCALES.includes(code) ? code : 'en';
}

/**
 * @param {string} [lang]
 */
export function getLocalePack(lang) {
  const code = resolveLang(lang);
  return PACKS[code] ?? PACKS.en;
}
