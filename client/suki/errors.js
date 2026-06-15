/**
 * RGS error codes → player-facing copy and handling policy (Stake ERR_* set).
 */

/** @typedef {'fatal' | 'block_bet' | 'resume_round' | 'retry' | 'info'} ErrorAction */

/**
 * @typedef {object} RgsErrorPolicy
 * @property {string} code
 * @property {string} message
 * @property {ErrorAction} action
 * @property {boolean} fatal
 * @property {boolean} blockBet
 * @property {boolean} shouldResumeRound
 * @property {boolean} retryable
 */

const MESSAGES = {
  ERR_SCR: 'Configuration error — contact support.',
  ERR_OPT: 'Configuration error — contact support.',
  ERR_IPB: 'Insufficient Funds.',
  ERR_IS: 'Session expired — reopen the game from Stake.',
  ERR_ATE: 'Authentication expired — reopen the game from Stake.',
  ERR_GLE: 'Gambling limit reached.',
  ERR_BNF: 'Replay not found.',
  ERR_BE: 'Resuming unfinished round…',
  ERR_UE: 'Server error — try again shortly.',
  ERR_GE: 'Server error — try again shortly.',
  ERR_GEN: 'Server error — try again shortly.',
  ERR_NET: 'Connection lost — check your network.',
  ERR_VAL: 'Invalid request.',
};

const POLICIES = {
  ERR_IS: { action: 'fatal', fatal: true, blockBet: true, shouldResumeRound: false, retryable: false },
  ERR_ATE: { action: 'fatal', fatal: true, blockBet: true, shouldResumeRound: false, retryable: false },
  ERR_IPB: { action: 'block_bet', fatal: false, blockBet: true, shouldResumeRound: false, retryable: false },
  ERR_GLE: { action: 'fatal', fatal: true, blockBet: true, shouldResumeRound: false, retryable: false },
  ERR_BE: { action: 'resume_round', fatal: false, blockBet: true, shouldResumeRound: true, retryable: false },
  ERR_BNF: { action: 'info', fatal: false, blockBet: false, shouldResumeRound: false, retryable: false },
  ERR_UE: { action: 'retry', fatal: false, blockBet: true, shouldResumeRound: false, retryable: true },
  ERR_GE: { action: 'retry', fatal: false, blockBet: true, shouldResumeRound: false, retryable: true },
  ERR_GEN: { action: 'retry', fatal: false, blockBet: true, shouldResumeRound: false, retryable: true },
  ERR_NET: { action: 'retry', fatal: false, blockBet: true, shouldResumeRound: false, retryable: true },
  ERR_VAL: { action: 'info', fatal: false, blockBet: false, shouldResumeRound: false, retryable: false },
};

const DEFAULT_POLICY = {
  action: 'info',
  fatal: false,
  blockBet: false,
  shouldResumeRound: false,
  retryable: false,
};

/**
 * @param {string} code
 * @param {{ copy?: { term: (key: string) => string } }} [options]
 */
export function messageForRgsCode(code, options = {}) {
  const { copy } = options;
  if (copy) {
    if (code === 'ERR_IPB') return copy.term('insufficientBalance');
    if (code === 'ERR_GLE') return copy.term('gamblingLimitReached');
  }
  return MESSAGES[code] ?? `Error — ${code}`;
}

export function isSessionFatal(code) {
  return classifyRgsError(code).fatal;
}

/**
 * @param {string} code
 * @param {{ copy?: { term: (key: string) => string } }} [options]
 * @returns {RgsErrorPolicy}
 */
export function classifyRgsError(code, options = {}) {
  const policy = POLICIES[code] ?? DEFAULT_POLICY;
  return {
    code,
    message: messageForRgsCode(code, options),
    action: policy.action,
    fatal: policy.fatal,
    blockBet: policy.blockBet,
    shouldResumeRound: policy.shouldResumeRound,
    retryable: policy.retryable,
  };
}

/**
 * @param {string} code
 * @param {{ setMessage?: (text: string) => void, onFatal?: () => void, onBlockBet?: () => void, copy?: { term: (key: string) => string } }} [ctx]
 * @returns {RgsErrorPolicy}
 */
export function applyRgsError(code, ctx = {}) {
  const policy = classifyRgsError(code, { copy: ctx.copy });
  ctx.setMessage?.(policy.message);
  if (policy.fatal) ctx.onFatal?.();
  if (policy.blockBet) ctx.onBlockBet?.();
  return policy;
}
