import { apiToDisplay } from '../money.js';

const MAX_GENERATED_LEVELS = 50;

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {number} amount
 * @param {number} min
 * @param {number} step
 */
function isStepAligned(amount, min, step) {
  const delta = amount - min;
  if (!Number.isFinite(delta)) return true;
  const remainder = delta % step;
  return remainder === 0 || Math.abs(remainder - step) < 1e-6;
}

/**
 * @param {object} input
 * @param {number[] | undefined} input.betLevels
 * @param {number | null} input.minBetApi
 * @param {number | null} input.maxBetApi
 * @param {number | null} input.stepBetApi
 * @returns {number[]}
 */
export function buildBetLevelsApi({
  betLevels = [],
  minBetApi = null,
  maxBetApi = null,
  stepBetApi = null,
}) {
  const min = minBetApi ?? -Infinity;
  const max = maxBetApi ?? Infinity;
  const step = stepBetApi && stepBetApi > 0 ? stepBetApi : null;

  const explicit = (Array.isArray(betLevels) ? betLevels : [])
    .map(toFiniteNumber)
    .filter((n) => n != null);

  if (explicit.length) {
    const unique = [...new Set(explicit)].sort((a, b) => a - b);
    return unique.filter((amount) => {
      if (amount < min || amount > max) return false;
      if (step != null && minBetApi != null && !isStepAligned(amount, minBetApi, step)) {
        return false;
      }
      return true;
    });
  }

  if (minBetApi == null || maxBetApi == null || step == null) {
    return [];
  }

  const generated = [];
  for (let amount = minBetApi; amount <= maxBetApi; amount += step) {
    generated.push(amount);
    if (generated.length >= MAX_GENERATED_LEVELS) break;
  }
  return generated;
}

/**
 * @param {number} amountApi
 * @param {object} bounds
 * @param {number | null} bounds.minBetApi
 * @param {number | null} bounds.maxBetApi
 * @param {number | null} bounds.stepBetApi
 * @param {number[]} bounds.betLevelsApi
 */
export function clampBetApi(amountApi, { minBetApi, maxBetApi, stepBetApi, betLevelsApi }) {
  let value = Number(amountApi);
  if (!Number.isFinite(value)) {
    value = minBetApi ?? betLevelsApi?.[0] ?? 0;
  }

  if (betLevelsApi?.length) {
    if (betLevelsApi.includes(value)) return value;
    let best = betLevelsApi[0];
    let bestDistance = Math.abs(value - best);
    for (const level of betLevelsApi) {
      const distance = Math.abs(value - level);
      if (distance < bestDistance) {
        best = level;
        bestDistance = distance;
      }
    }
    return best;
  }

  const min = minBetApi ?? value;
  const max = maxBetApi ?? value;
  const step = stepBetApi && stepBetApi > 0 ? stepBetApi : 1;

  value = Math.max(min, Math.min(max, value));
  const steps = Math.round((value - min) / step);
  return min + steps * step;
}

/**
 * @param {object} config — authenticate `config` object
 */
export function hasAuthBetConfig(config) {
  if (!config || typeof config !== 'object') return false;
  return (
    config.minBet != null
    || config.maxBet != null
    || config.stepBet != null
    || config.defaultBetLevel != null
    || (Array.isArray(config.betLevels) && config.betLevels.length > 0)
  );
}

/**
 * @param {object} auth — parsed authenticate config
 */
export function createBetConfigPolicy(auth) {
  const {
    minBetApi,
    maxBetApi,
    stepBetApi,
    betLevelsApi,
    betLevelsDisplay,
    defaultBetDisplay,
    hasBetConfig,
  } = auth;

  function clampBaseBetApi(amountApi) {
    if (!hasBetConfig) return amountApi;
    return clampBetApi(amountApi, { minBetApi, maxBetApi, stepBetApi, betLevelsApi });
  }

  function isAllowedBaseBetApi(amountApi) {
    if (!hasBetConfig) return true;
    const clamped = clampBaseBetApi(amountApi);
    return clamped === Number(amountApi);
  }

  return {
    hasConfig: hasBetConfig,
    minBetApi,
    maxBetApi,
    stepBetApi,
    betLevelsApi,
    betLevelsDisplay,
    defaultBetDisplay,
    clampBaseBetApi,
    isAllowedBaseBetApi,
  };
}

/**
 * When authenticate includes an active round, default bet comes from round.amount
 * (converted to base bet when a buy/ante mode multiplier applies).
 *
 * @param {object} auth — parseAuthResponse() result (mutated)
 * @param {object | null | undefined} round — authenticate round
 * @param {{ baseBetApiFromPlayAmount?: (amountApi: number, rgsMode?: string) => number } | null} [betModePolicy]
 */
export function applyAuthRoundBetOverride(auth, round, betModePolicy = null) {
  if (!auth || !round?.active) return false;

  const playAmountApi = Number(round.amount);
  if (!Number.isFinite(playAmountApi) || playAmountApi <= 0) return false;

  let baseBetApi = playAmountApi;
  if (betModePolicy?.baseBetApiFromPlayAmount) {
    baseBetApi = betModePolicy.baseBetApiFromPlayAmount(playAmountApi, round.mode);
  }

  const policy = createBetConfigPolicy(auth);
  if (policy.hasConfig) {
    baseBetApi = policy.clampBaseBetApi(baseBetApi);
  }

  auth.defaultBetApi = baseBetApi;
  auth.defaultBetDisplay = apiToDisplay(baseBetApi);
  auth.usesActiveRoundBet = true;
  return true;
}

/**
 * Apply resolved authenticate bet config to game bet state and chip UI.
 *
 * @param {object} auth — parseAuthResponse() result
 * @param {object} ctx
 * @param {{ setBetLevels?: (levels: number[], defaultBet?: number) => void, renderBetLevels?: () => void } | null} [ctx.betUi]
 * @param {() => number} ctx.getBet
 * @param {(amount: number) => void} ctx.setBet
 * @param {() => number[]} ctx.getBetOptions
 * @param {(levels: number[]) => void} ctx.setBetOptions
 */
export function applyAuthBetConfig(auth, ctx) {
  const hasBetLevels = auth?.hasBetConfig && auth.betLevelsDisplay?.length;
  const usesActiveRoundBet = !!auth?.usesActiveRoundBet && auth.defaultBetDisplay != null;

  if (!hasBetLevels && !usesActiveRoundBet) return false;

  if (hasBetLevels) {
    ctx.setBetOptions(auth.betLevelsDisplay);
  }

  const defaultBet = auth.defaultBetDisplay ?? auth.betLevelsDisplay?.[0];
  if (defaultBet == null) return false;

  ctx.setBet(defaultBet);
  if (hasBetLevels) {
    ctx.betUi?.setBetLevels?.(auth.betLevelsDisplay, defaultBet);
  } else {
    ctx.betUi?.renderBetLevels?.();
  }
  return true;
}
