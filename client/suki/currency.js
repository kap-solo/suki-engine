/**
 * Display currency formatting from authenticate balance.currency.
 * Social casino codes (XGC, XSC) use Stake-style labels without Intl currency.
 */

/** Stake social currencies — no Intl localisation. */
export const SOCIAL_CURRENCY_LABELS = {
  XGC: 'GC',
  XSC: 'SC',
};

/**
 * @param {string} [lang]
 * @returns {string}
 */
export function langToLocale(lang) {
  if (!lang || lang === 'en') return 'en';
  return lang.replace('_', '-');
}

/**
 * @param {number} amount — display units (post apiToDisplay)
 * @param {string} [currency='USD']
 * @param {{ locale?: string }} [options]
 */
export function formatCurrencyAmount(amount, currency = 'USD', options = {}) {
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

/**
 * @param {{ currency?: string, locale?: string, language?: string }} [config]
 */
export function createCurrencyFormatter(config = {}) {
  const currency = config.currency ?? 'USD';
  const locale = config.locale ?? langToLocale(config.language);

  return {
    currency,
    locale,
    /** @param {number} amount */
    format(amount) {
      return formatCurrencyAmount(amount, currency, { locale });
    },
  };
}
