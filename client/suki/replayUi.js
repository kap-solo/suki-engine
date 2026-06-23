/**
 * Replay intro copy — Stake checklist: play amount, multiplier, final amount.
 */

/**
 * @param {ReturnType<import('./copy.js').createCopyPolicy>} copy
 * @param {{ playAmount: number, payoutMultiplier: number, finalAmount: number }} amounts — display units
 * @param {{ formatCurrency?: (n: number) => string, formatBalance?: (n: number) => string, formatWin?: (n: number) => string, formatMult: (n: number) => string }} fmt
 */
export function formatReplayStartSummary(copy, amounts, fmt) {
  const { playAmount, payoutMultiplier, finalAmount } = amounts;
  const formatBalance = fmt.formatBalance ?? fmt.formatCurrency ?? ((n) => String(n));
  const formatWin = fmt.formatWin ?? fmt.formatCurrency ?? ((n) => String(n));
  return copy.t('replayStartSummary', {
    playLabel: copy.t('replayPlayLabel'),
    playAmount: formatBalance(playAmount),
    worthLabel: copy.t('payoutMultiplierLabel'),
    worthMult: fmt.formatMult(payoutMultiplier),
    finalLabel: copy.t('replayFinalAmountLabel'),
    finalAmount: formatWin(finalAmount),
  });
}
