/**
 * Display currency formatting from authenticate balance.currency.
 * Balance uses 2 decimal places; win/payout amounts use full RGS precision (6 dp).
 */

import { API_AMOUNT_MULTIPLIER } from '../money.js';

/** Stake social currencies — no Intl localisation. */
export const SOCIAL_CURRENCY_LABELS = {
  XGC: 'GC',
  XSC: 'SC',
};

/** Display decimals matching Stake API money (1_000_000 = $1.00). */
export const STAKE_MONEY_DECIMALS = Math.round(Math.log10(API_AMOUNT_MULTIPLIER));

/**
 * @param {string} [lang]
 * @returns {string}
 */
export function langToLocale(lang) {
  if (!lang || lang === 'en') return 'en';
  return lang.replace('_', '-');
}

/**
 * @param {number} value
 * @param {number} [maxDecimals]
 */
export function formatWinDecimalString(value, maxDecimals = STAKE_MONEY_DECIMALS) {
  if (!Number.isFinite(value)) return '—';
  const minDecimals = Math.min(2, maxDecimals);
  const fixed = value.toFixed(maxDecimals);
  const dot = fixed.indexOf('.');
  if (dot === -1) return `${fixed}.${'0'.repeat(minDecimals)}`;

  const intPart = fixed.slice(0, dot);
  let frac = fixed.slice(dot + 1);
  while (frac.length > minDecimals && frac.endsWith('0')) {
    frac = frac.slice(0, -1);
  }
  while (frac.length < minDecimals) {
    frac += '0';
  }
  return `${intPart}.${frac}`;
}

/**
 * Balance display — rounded to 2 decimal places.
 * @param {number} amount — display units (post apiToDisplay)
 * @param {string} [currency='USD']
 * @param {{ locale?: string }} [options]
 */
export function formatBalanceAmount(amount, currency = 'USD', options = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';

  const socialLabel = SOCIAL_CURRENCY_LABELS[currency];
  if (socialLabel) {
    return `${socialLabel} ${value.toFixed(2)}`;
  }

  const locale = options.locale ?? 'en';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** @deprecated Use formatBalanceAmount — kept for existing imports. */
export const formatCurrencyAmount = formatBalanceAmount;

/**
 * Win / payout display — full RGS precision, not rounded to 2 decimals.
 * @param {number} amount — display units (post apiToDisplay)
 * @param {string} [currency='USD']
 * @param {{ locale?: string }} [options]
 */
export function formatWinAmount(amount, currency = 'USD', options = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';

  const socialLabel = SOCIAL_CURRENCY_LABELS[currency];
  const decimalText = formatWinDecimalString(value);
  if (socialLabel) {
    return `${socialLabel} ${decimalText}`;
  }

  const locale = options.locale ?? 'en';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: STAKE_MONEY_DECIMALS,
    }).format(value);
  } catch {
    return `${currency} ${decimalText}`;
  }
}

/**
 * @param {{ currency?: string, locale?: string, language?: string }} [config]
 */
export function createCurrencyFormatter(config = {}) {
  const currency = config.currency ?? 'USD';
  const locale = config.locale ?? langToLocale(config.language);

  return {
    currency,
    locale,
    /** Balance — 2 decimal places. */
    formatBalance(amount) {
      return formatBalanceAmount(amount, currency, { locale });
    },
    /** Win / payout — full RGS precision. */
    formatWin(amount) {
      return formatWinAmount(amount, currency, { locale });
    },
    /** @param {number} amount — balance formatting (backward compatible). */
    format(amount) {
      return formatBalanceAmount(amount, currency, { locale });
    },
  };
}
