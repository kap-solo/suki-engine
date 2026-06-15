/**
 * Stake bet/event reporting rules — skip when replay or zero payout.
 */

/**
 * @param {{ payout?: number } | null | undefined} round
 */
export function shouldSkipBetEventReporting(round) {
  return Number(round?.payout ?? 0) === 0;
}
