/**
 * Client-side play affordability — block /wallet/play before it reaches RGS.
 * Matches Stake web-sdk isBetCostAvailable(): betCost > 0 && betCost <= balance.
 */

/**
 * @param {number} balanceApi
 * @param {number} amountApi
 */
export function canAffordPlayAmount(balanceApi, amountApi) {
  const balance = Number(balanceApi);
  const amount = Number(amountApi);
  if (!Number.isFinite(balance) || !Number.isFinite(amount) || amount <= 0) return false;
  return balance >= amount;
}

/**
 * @param {number} balanceApi
 * @param {number} amountApi
 */
export function assertSufficientBalanceForPlay(balanceApi, amountApi) {
  if (!canAffordPlayAmount(balanceApi, amountApi)) {
    throw new Error('ERR_IPB');
  }
}
