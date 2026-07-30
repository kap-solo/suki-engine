/**
 * Autoplay session — stop waits for the current full spin; no mid-cascade cancel.
 */

const DEFAULT_STOP_LABEL = 'Stopping…';

/**
 * @param {object} options
 * @param {() => boolean} options.canStart
 * @param {() => Promise<void>} [options.prepareStart]
 * @param {() => Promise<void>} options.runSpin — one wager through presentation lock
 * @param {() => number} options.getPlayCost
 * @param {() => number} options.getBalance
 * @param {(cost: number) => void} [options.onDebit]
 * @param {() => void} [options.onSync]
 * @param {(text: string) => void} [options.setMessage]
 * @param {(key: string, vars?: Record<string, string | number>) => string} [options.t]
 */
export function createAutoplayController(options) {
  let active = false;
  let stopRequested = false;
  let currentRound = 0;
  let totalRounds = 0;

  function stoppedMessage() {
    const prefix = options.t?.('autoplayStopped') ?? 'Autoplay stopped after';
    return `${prefix} ${currentRound} spins.`;
  }

  function stop() {
    if (!active) return;
    stopRequested = true;
    options.onSync?.();
  }

  /**
   * @param {number} roundCount
   * @returns {Promise<boolean>} true when a session started
   */
  async function run(roundCount) {
    if (active || !options.canStart()) return false;

    stopRequested = false;
    totalRounds = roundCount;
    currentRound = 0;

    await options.prepareStart?.();

    active = true;
    options.onSync?.();

    try {
      for (let i = 0; i < roundCount; i += 1) {
        if (stopRequested) {
          options.setMessage?.(stoppedMessage());
          break;
        }

        const playCost = options.getPlayCost();
        if (options.getBalance() < playCost) {
          options.setMessage?.(stoppedMessage());
          break;
        }

        currentRound = i + 1;
        options.onDebit?.(playCost);
        options.onSync?.();

        await options.runSpin();

        if (stopRequested) {
          options.setMessage?.(stoppedMessage());
          break;
        }
      }

      if (currentRound === roundCount && !stopRequested) {
        const complete = options.t?.('autoplayComplete', { count: roundCount })
          ?? `Autoplay complete — ${roundCount} spins.`;
        options.setMessage?.(complete);
      }
    } finally {
      active = false;
      stopRequested = false;
      totalRounds = 0;
      currentRound = 0;
      options.onSync?.();
    }

    return true;
  }

  return {
    run,
    stop,
    get active() {
      return active;
    },
    get stopRequested() {
      return stopRequested;
    },
    get progress() {
      return { current: currentRound, total: totalRounds };
    },
    get stopLabel() {
      return options.t?.('autoplayStopping') ?? DEFAULT_STOP_LABEL;
    },
  };
}

export { DEFAULT_STOP_LABEL as AUTOPLAY_STOP_LABEL };
