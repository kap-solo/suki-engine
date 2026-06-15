/**
 * Replay intro copy — Stake checklist: play amount, multiplier, final amount.
 */

/**
 * @param {ReturnType<import('./copy.js').createCopyPolicy>} copy
 * @param {{ playAmount: number, payoutMultiplier: number, finalAmount: number }} amounts — display units
 * @param {{ formatCurrency: (n: number) => string, formatMult: (n: number) => string }} fmt
 */
export function formatReplayStartSummary(copy, amounts, fmt) {
  const { playAmount, payoutMultiplier, finalAmount } = amounts;
  return copy.t('replayStartSummary', {
    playLabel: copy.t('replayPlayLabel'),
    playAmount: fmt.formatCurrency(playAmount),
    worthLabel: copy.t('payoutMultiplierLabel'),
    worthMult: fmt.formatMult(payoutMultiplier),
    finalLabel: copy.t('replayFinalAmountLabel'),
    finalAmount: fmt.formatCurrency(finalAmount),
  });
}
