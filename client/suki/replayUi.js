/**
 * Replay chrome — Stake checklist: not a live bet, play amount, multiplier, final amount.
 */

import { apiToDisplay } from '../money.js';

/**
 * Base bet for replay presentation — use the recorded round amount, not authenticate ladder snap.
 * @param {object} round
 * @param {{ baseBetApiFromPlayAmount: (amountApi: number, mode?: string) => number }} betModePolicy
 */
export function resolveReplayBaseBetApi(round, betModePolicy) {
  return betModePolicy.baseBetApiFromPlayAmount(round.amount, round.mode);
}

/** @param {object} round @param {{ baseBetApiFromPlayAmount: (amountApi: number, mode?: string) => number }} betModePolicy */
export function resolveReplayBaseBetDisplay(round, betModePolicy) {
  return apiToDisplay(resolveReplayBaseBetApi(round, betModePolicy));
}

/** @param {number} mult — display multiplier (payout ÷ cost). */
export function formatReplaySummaryMultiplier(mult) {
  if (!Number.isFinite(mult)) return '—';
  return `${mult.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}×`;
}

/** Payout multiplier derived from settled RGS amounts (matches total cost × mult = total win). */
export function replaySettlementMultiplier(round) {
  const amountApi = Number(round?.amount);
  const payoutApi = Number(round?.payout ?? 0);
  if (!Number.isFinite(amountApi) || amountApi <= 0) return Number.NaN;
  return payoutApi / amountApi;
}

/** @param {object} round */
export function formatReplayPayoutMultiplier(round) {
  return formatReplaySummaryMultiplier(replaySettlementMultiplier(round));
}

/**
 * Mark the shell and replay banner as active replay mode.
 *
 * @param {object} options
 * @param {HTMLElement | null} [options.shell]
 * @param {HTMLElement | null} [options.banner]
 * @param {HTMLElement | null} [options.noteEl]
 * @param {ReturnType<import('./copy.js').createCopyPolicy>} options.copy
 */
export function applyReplayModeChrome({ shell, banner, noteEl, copy }) {
  if (shell) {
    shell.dataset.sukiReplay = 'true';
  }
  if (banner) {
    banner.hidden = false;
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    const label = banner.querySelector('.replay-label');
    if (label) {
      label.textContent = copy.t('replayModeTitle');
    }
  }
  if (noteEl) {
    noteEl.textContent = copy.t('replayDisclaimer');
  }
}

/**
 * @param {ReturnType<import('./copy.js').createCopyPolicy>} copy
 * @param {{ playAmount: number, payoutMultiplier: number, finalAmount: number }} amounts — display units
 * @param {{ formatCurrency?: (n: number) => string, formatBalance?: (n: number) => string, formatWin?: (n: number) => string, formatMult: (n: number) => string }} fmt
 */
export function formatReplayStartSummary(copy, amounts, fmt) {
  const { playAmount, payoutMultiplier, finalAmount } = amounts;
  const formatBalance = fmt.formatBalance ?? fmt.formatCurrency ?? ((n) => String(n));
  const formatWin = fmt.formatWin ?? fmt.formatCurrency ?? ((n) => String(n));
  const roundSummary = copy.t('replayStartSummary', {
    playLabel: copy.t('replayPlayLabel'),
    playAmount: formatBalance(playAmount),
    worthLabel: copy.t('payoutMultiplierLabel'),
    worthMult: fmt.formatMult(payoutMultiplier),
    finalLabel: copy.t('replayFinalAmountLabel'),
    finalAmount: formatWin(finalAmount),
  });
  return `${copy.t('replayDisclaimer')} ${roundSummary}`;
}
