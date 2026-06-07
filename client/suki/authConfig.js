import { apiToDisplay } from '../money.js';

/**
 * Normalise /wallet/authenticate response for game UI.
 * @param {object} data — authenticate response
 * @param {{ defaultBetDisplay?: number, urlCurrency?: string }} [options]
 */
export function parseAuthResponse(data, options = {}) {
  const config = data?.config ?? {};
  const balance = data?.balance ?? null;

  const betLevelsApi = config.betLevels ?? [];
  const defaultBetApi = config.defaultBetLevel ?? betLevelsApi[0] ?? null;

  let defaultBetDisplay = options.defaultBetDisplay ?? null;
  if (defaultBetApi != null) {
    defaultBetDisplay = apiToDisplay(defaultBetApi);
  }

  const betLevelsDisplay = betLevelsApi.map(apiToDisplay);
  if (defaultBetDisplay != null && betLevelsDisplay.length && !betLevelsDisplay.includes(defaultBetDisplay)) {
    defaultBetDisplay = betLevelsDisplay[0];
  }

  return {
    balance,
    balanceDisplay: balance ? apiToDisplay(balance.amount) : null,
    currency: balance?.currency ?? options.urlCurrency ?? 'USD',
    gameId: config.gameID ?? null,
    minBetApi: config.minBet ?? null,
    maxBetApi: config.maxBet ?? null,
    stepBetApi: config.stepBet ?? null,
    defaultBetApi,
    betLevelsApi,
    betLevelsDisplay,
    defaultBetDisplay,
    betModes: config.betModes ?? {},
    jurisdiction: config.jurisdiction ?? {},
    round: data?.round ?? null,
    meta: data?.meta ?? {},
  };
}
