/**
 * UI copy policy — real-money vs social casino terminology.
 * Aligns with Stake web-sdk social=true / jurisdiction.socialCasino.
 */

import { isDevMode } from './config.js';

/** @typedef {keyof typeof REAL_MONEY_COPY} CopyTerm */

export const REAL_MONEY_COPY = {
  balance: 'Balance',
  bet: 'Bet',
  betAmount: 'Bet amount',
  lastResult: 'Last result',
  drop: 'Drop',
  playVerb: 'play',
  insufficientBalance: 'Not enough balance.',
  setBetPrompt: 'Set bet · press Drop.',
  connectingRgs: 'Connecting to RGS…',
  sessionPl: 'Session P/L',
  sessionPlays: 'Session plays',
  replayNote: 'Recorded round — not a live bet',
  stakeReturned: 'push, stake returned',
  won: 'won',
  onAmount: 'on',
  newSessionBalance: 'New session — balance',
  autoplayStopped: 'Autoplay stopped — insufficient balance after',
};

export const SOCIAL_CASINO_COPY = {
  balance: 'Coins',
  bet: 'Play',
  betAmount: 'Play amount',
  lastResult: 'Last result',
  drop: 'Drop',
  playVerb: 'play',
  insufficientBalance: 'Not enough coins.',
  setBetPrompt: 'Set play amount · press Drop.',
  connectingRgs: 'Connecting…',
  sessionPl: 'Session coins',
  sessionPlays: 'Session plays',
  replayNote: 'Recorded round — not a live play',
  stakeReturned: 'push, play amount returned',
  won: 'won',
  onAmount: 'on',
  newSessionBalance: 'New session — coins',
  autoplayStopped: 'Autoplay stopped — insufficient coins after',
};

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
 * @param {boolean} [options.socialCasino]
 * @param {Partial<typeof REAL_MONEY_COPY>} [options.overrides]
 */
export function createCopyPolicy(options = {}) {
  const { socialCasino = false, overrides = {} } = options;
  const base = socialCasino ? SOCIAL_CASINO_COPY : REAL_MONEY_COPY;
  const terms = { ...base, ...overrides };

  return {
    get socialCasino() {
      return socialCasino;
    },
    get terms() {
      return { ...terms };
    },
    /** @param {CopyTerm} key */
    term(key) {
      return terms[key] ?? key;
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
