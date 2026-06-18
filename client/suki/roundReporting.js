/**
 * Stake round settlement rules — zero-win rounds skip bet/event and end-round.
 * Matches web-sdk getBetType(): payoutMultiplier > 0 → singleRoundWin, else noWin.
 */

/**
 * @param {{ payout?: number, payoutMultiplier?: number } | null | undefined} round
 */
export function isZeroWinRound(round) {
  const mult = Number(round?.payoutMultiplier ?? Number.NaN);
  if (Number.isFinite(mult)) return mult <= 0;
  return Number(round?.payout ?? 0) === 0;
}

/**
 * @param {{ payout?: number, payoutMultiplier?: number } | null | undefined} round
 */
export function shouldSkipBetEventReporting(round) {
  return isZeroWinRound(round);
}

/**
 * @param {{ payout?: number, payoutMultiplier?: number } | null | undefined} round
 */
export function shouldSkipEndRound(round) {
  return isZeroWinRound(round);
}
