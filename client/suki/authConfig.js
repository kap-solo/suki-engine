import { apiToDisplay } from '../money.js';
import { buildBetLevelsApi, clampBetApi, hasAuthBetConfig } from './betConfig.js';

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toConfigNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Normalise /wallet/authenticate response for game UI.
 * @param {object} data — authenticate response
 * @param {{ defaultBetDisplay?: number, urlCurrency?: string }} [options]
 */
export function parseAuthResponse(data, options = {}) {
  const config = data?.config ?? {};
  const balance = data?.balance ?? null;

  const minBetApi = toConfigNumber(config.minBet);
  const maxBetApi = toConfigNumber(config.maxBet);
  const stepBetApi = toConfigNumber(config.stepBet);

  const betLevelsApi = buildBetLevelsApi({
    betLevels: config.betLevels,
    minBetApi,
    maxBetApi,
    stepBetApi,
  });

  let defaultBetApi = toConfigNumber(config.defaultBetLevel) ?? betLevelsApi[0] ?? minBetApi;
  if (defaultBetApi != null) {
    defaultBetApi = clampBetApi(defaultBetApi, {
      minBetApi,
      maxBetApi,
      stepBetApi,
      betLevelsApi,
    });
  }

  let defaultBetDisplay = options.defaultBetDisplay ?? null;
  if (defaultBetApi != null) {
    defaultBetDisplay = apiToDisplay(defaultBetApi);
  }

  const betLevelsDisplay = betLevelsApi.map(apiToDisplay);
  if (
    defaultBetDisplay != null
    && betLevelsDisplay.length
    && !betLevelsDisplay.includes(defaultBetDisplay)
  ) {
    defaultBetDisplay = betLevelsDisplay[0];
  }

  return {
    balance,
    balanceDisplay: balance ? apiToDisplay(balance.amount) : null,
    currency: balance?.currency ?? options.urlCurrency ?? 'USD',
    gameId: config.gameID ?? null,
    minBetApi,
    maxBetApi,
    stepBetApi,
    defaultBetApi,
    betLevelsApi,
    betLevelsDisplay,
    defaultBetDisplay,
    hasBetConfig: hasAuthBetConfig(config),
    usesActiveRoundBet: false,
    betModes: config.betModes ?? {},
    jurisdiction: config.jurisdiction ?? {},
    round: data?.round ?? null,
    meta: data?.meta ?? {},
  };
}
