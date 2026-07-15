/**
 * Display currency formatting from authenticate balance.currency.
 * Balance uses 2 decimal places; win/payout amounts use full RGS precision (6 dp).
 *
 * Resolution order:
 * 1. Known social / sweepstakes codes (SOCIAL_CURRENCY_LABELS) — never show raw code
 * 2. RGS-provided display label (authenticate) when present
 * 3. Intl.NumberFormat when the currency is recognised
 * 4. Legacy fallback: code + amount (unchanged for existing fiat edge cases)
 */

import { API_AMOUNT_MULTIPLIER } from '../money.js';

/**
 * Stake social / sweepstakes currencies — Intl does not localise these.
 * Player-facing label only; internal code stays on balance.currency (e.g. XEC).
 */
export const SOCIAL_CURRENCY_LABELS = {
  XGC: 'GC',
  XSC: 'SC',
  XEC: 'SC',
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
 * @param {string} currency
 * @param {{ locale?: string, currencyDisplay?: string | null, minimumFractionDigits?: number, maximumFractionDigits?: number, decimalText?: string }} options
 * @param {(value: number) => string} decimalTextForValue
 */
function formatAmountWithCurrency(currency, options, decimalTextForValue) {
  return (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '—';

    const socialLabel = SOCIAL_CURRENCY_LABELS[currency];
    if (socialLabel) {
      return `${socialLabel} ${decimalTextForValue(value)}`;
    }

    const display = options.currencyDisplay?.trim();
    if (display) {
      return `${display} ${decimalTextForValue(value)}`;
    }

    const locale = options.locale ?? 'en';
    const minDigits = options.minimumFractionDigits ?? 2;
    const maxDigits = options.maximumFractionDigits ?? 2;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits,
      }).format(value);
    } catch {
      if (display) {
        return `${display} ${decimalTextForValue(value)}`;
      }
      return `${currency} ${decimalTextForValue(value)}`;
    }
  };
}

/**
 * Balance display — rounded to 2 decimal places.
 * @param {number} amount — display units (post apiToDisplay)
 * @param {string} [currency='USD']
 * @param {{ locale?: string, currencyDisplay?: string | null }} [options]
 */
export function formatBalanceAmount(amount, currency = 'USD', options = {}) {
  const format = formatAmountWithCurrency(currency, {
    ...options,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }, (value) => value.toFixed(2));
  return format(amount);
}

/** @deprecated Use formatBalanceAmount — kept for existing imports. */
export const formatCurrencyAmount = formatBalanceAmount;

/**
 * Win / payout display — full RGS precision, not rounded to 2 decimals.
 * @param {number} amount — display units (post apiToDisplay)
 * @param {string} [currency='USD']
 * @param {{ locale?: string, currencyDisplay?: string | null }} [options]
 */
export function formatWinAmount(amount, currency = 'USD', options = {}) {
  const format = formatAmountWithCurrency(currency, {
    ...options,
    minimumFractionDigits: 2,
    maximumFractionDigits: STAKE_MONEY_DECIMALS,
  }, formatWinDecimalString);
  return format(amount);
}

/**
 * @param {{ currency?: string, locale?: string, language?: string, currencyDisplay?: string | null }} [config]
 */
export function createCurrencyFormatter(config = {}) {
  const currency = config.currency ?? 'USD';
  const locale = config.locale ?? langToLocale(config.language);
  const currencyDisplay = config.currencyDisplay ?? null;
  const formatOptions = { locale, currencyDisplay };

  return {
    currency,
    locale,
    currencyDisplay,
    /** Balance — 2 decimal places. */
    formatBalance(amount) {
      return formatBalanceAmount(amount, currency, formatOptions);
    },
    /** Win / payout — full RGS precision. */
    formatWin(amount) {
      return formatWinAmount(amount, currency, formatOptions);
    },
    /** @param {number} amount — balance formatting (backward compatible). */
    format(amount) {
      return formatBalanceAmount(amount, currency, formatOptions);
    },
  };
}
