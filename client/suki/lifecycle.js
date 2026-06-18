/**
 * Suki round lifecycle — outcome from RGS, presentation via book event player.
 * play → walk round.state → bet/event per step → end-round (skipped on zero win)
 */

import { endRound, play } from '../rgs.js';
import { messageForRgsCode, classifyRgsError } from './errors.js';
import { createBookPlayer, resolveLastEventIndex, sortBookEvents, sliceEventsForResume } from './bookPlayer.js';
import { shouldReportBetEvents } from './environment.js';
import { assertSufficientBalanceForPlay } from './balanceGuard.js';
import { shouldSkipBetEventReporting, shouldSkipEndRound } from './roundReporting.js';

/**
 * @param {object} deps
 * @param {object} deps.jurisdiction — createJurisdictionController instance
 * @param {Record<string, (event: object, ctx: object) => Promise<void>>} deps.handlers — book event handlers by type
 * @param {(round: object) => void} [deps.onResumeStatic] — show board after completed events on resume
 * @param {(round: object) => void} [deps.onStaticRound] — show final state when animate=false
 * @param {(balance: object) => void} deps.applyBalance
 * @param {(round: object, result: object, ctx: { recordSession: boolean }) => void} deps.onRoundSettled
 * @param {(text: string) => void} deps.setMessage
 * @param {() => number} deps.getBetApi
 * @param {(amountApi: number) => void} deps.setBetFromApi
 * @param {(round: object) => object} deps.buildSettledResult
 * @param {() => number} [deps.getBalanceApi] — tracked wallet balance in API units
 * @param {string} [deps.playingMessage='Playing…']
 * @param {() => object | null | undefined} [deps.getBetModePolicy] — createBetModePolicy()
 * @param {() => object | null | undefined} [deps.getBetConfigPolicy] — createBetConfigPolicy()
 */
export function createSukiLifecycle(deps) {
  const {
    jurisdiction,
    handlers,
    onResumeStatic,
    onStaticRound,
    applyBalance,
    onRoundSettled,
    setMessage,
    getBetApi,
    setBetFromApi,
    buildSettledResult,
    playingMessage = 'Playing…',
    getBetModePolicy,
    getBetConfigPolicy,
    getBalanceApi,
  } = deps;

  const bookPlayer = createBookPlayer({ handlers });

  function resolveBaseBetApi(amountApi) {
    const betPolicy = getBetConfigPolicy?.();
    let baseBetApi = amountApi;
    if (betPolicy?.hasConfig) {
      baseBetApi = betPolicy.clampBaseBetApi(baseBetApi);
    }
    return baseBetApi;
  }

  function syncBaseBetFromRound(round) {
    const policy = getBetModePolicy?.();
    const playAmountApi = policy
      ? policy.baseBetApiFromPlayAmount(round.amount, round.mode)
      : round.amount;
    setBetFromApi(resolveBaseBetApi(playAmountApi));
  }

  async function waitMinRoundDuration(roundStartMs) {
    const minMs = jurisdiction.minRoundDurationMs;
    const elapsed = Date.now() - roundStartMs;
    if (minMs > elapsed) {
      await new Promise((r) => setTimeout(r, minMs - elapsed));
    }
  }

  /**
   * @param {object} round
   * @param {{ animate?: boolean, recordSession?: boolean, lastEvent?: string | null, meta?: object }} [options]
   */
  async function completeRound(round, { animate = true, recordSession = true, lastEvent = null, meta = {} } = {}) {
    syncBaseBetFromRound(round);

    const events = sortBookEvents(round.state);
    const lastEventIndex =
      lastEvent !== null && lastEvent !== undefined
        ? Number(lastEvent)
        : resolveLastEventIndex(meta, round);
    const { completed, remaining } = sliceEventsForResume(events, lastEventIndex);
    const fullBookLastIndex = events.length ? events[events.length - 1].index : -1;
    const roundStart = Date.now();

    const skipEventReporting =
      !shouldReportBetEvents() || shouldSkipBetEventReporting(round);
    const handlerCtx = {
      round,
      animate,
      isResume: lastEventIndex >= 0,
      skipEventReporting,
    };

    if (lastEventIndex >= 0 && onResumeStatic) {
      onResumeStatic(round, completed);
    } else if (!animate && onStaticRound) {
      onStaticRound(round);
    } else if (remaining.length && animate) {
      setMessage(playingMessage);
    }

    const eventsToPlay = remaining.length ? remaining : events;

    if (eventsToPlay.length) {
      await bookPlayer.playEvents(eventsToPlay, handlerCtx, {
        skipReporting: skipEventReporting,
        fullBookLastIndex,
        waitBeforeLastEvent: jurisdiction.minRoundDurationMs
          ? () => waitMinRoundDuration(roundStart)
          : undefined,
      });
    }

    let replayEvent = null;
    if (shouldSkipEndRound(round)) {
      // Stake noWin — round settled on /wallet/play; do not call end-round.
    } else {
      const endRes = await endRound();
      applyBalance(endRes.balance);
      replayEvent = endRes.replayEvent;
    }

    const result = {
      ...buildSettledResult(round),
      replayEvent,
      round,
    };

    onRoundSettled(round, result, { recordSession });
    return result;
  }

  async function executeDrop({ animate = true } = {}) {
    const policy = getBetModePolicy?.();
    const baseBetApi = resolveBaseBetApi(getBetApi());
    const amountApi = policy ? policy.playAmountApi(baseBetApi) : baseBetApi;
    const mode = policy ? policy.rgsModeForPlay() : 'BASE';
    if (getBalanceApi) {
      assertSufficientBalanceForPlay(getBalanceApi(), amountApi);
    }
    const playRes = await play({ amountApi, mode });
    applyBalance(playRes.balance);
    return completeRound(playRes.round, { animate });
  }

  async function resumeRound(round, { lastEvent = null, meta = {} } = {}) {
    setMessage(messageForRgsCode('ERR_BE'));
    const lastIndex = lastEvent !== null && lastEvent !== undefined
      ? Number(lastEvent)
      : resolveLastEventIndex(meta, round);
    const animate = lastIndex < 0;
    return completeRound(round, { animate, lastEvent: lastEvent ?? meta?.lastEvent, meta });
  }

  function showCompletedRound(round) {
    if (!round?.state?.length) return false;
    syncBaseBetFromRound(round);
    onStaticRound?.(round);
    return buildSettledResult(round);
  }

  async function handleAuthRound(round, meta = {}) {
    if (round?.active && round.state?.length) {
      const result = await resumeRound(round, { meta, lastEvent: meta?.lastEvent ?? null });
      return { status: 'resumed', result };
    }
    if (round?.state?.length && round.active === false && round.payout !== undefined) {
      const result = showCompletedRound(round);
      return { status: 'completed', result };
    }
    return { status: 'ready', result: null };
  }

  return {
    completeRound,
    executeDrop,
    resumeRound,
    showCompletedRound,
    handleAuthRound,
    classifyRgsError,
  };
}
