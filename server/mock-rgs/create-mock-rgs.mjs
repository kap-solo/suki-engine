import {
  API_MULT,
  DEFAULT_JURISDICTION,
  JURISDICTION_MOCK,
  START_BALANCE_API,
} from './defaults.mjs';

/**
 * @typedef {object} MockRgsConfig
 * @property {string} gameId
 * @property {string} replayVersion
 * @property {(session: object, body: object) => object | { error: { code: string, message: string } }} resolvePlay
 * @property {(event: string, amountQuery: string | null, ctx: { replayStore: Map<string, object> }) => object | null} resolveReplay
 * @property {(session: object, body: object) => object | { error: { code: string, message: string } }} [resolveAction]
 * @property {object} [betConfig] — min/max/step bet levels for authenticate
 */

/**
 * @param {MockRgsConfig} config
 */
export function createMockRgs(config) {
  const {
    gameId,
    replayVersion,
    resolvePlay,
    resolveReplay,
    resolveAction = null,
    betConfig = {
      minBet: 1 * API_MULT,
      maxBet: 1000 * API_MULT,
      stepBet: 1 * API_MULT,
      defaultBetLevel: 1 * API_MULT,
      betLevels: [1, 5, 10].map((d) => d * API_MULT),
    },
  } = config;

  /** @type {Map<string, object>} */
  const sessions = new Map();

  /** @type {Map<string, object>} */
  const replayStore = new Map();

  function getSession(sessionID) {
    if (!sessions.has(sessionID)) {
      sessions.set(sessionID, {
        balance: START_BALANCE_API,
        currency: 'USD',
        roundID: 0,
        activeRound: null,
        lastCompletedRound: null,
        lastEvent: null,
      });
    }
    return sessions.get(sessionID);
  }

  function balanceObject(session) {
    return { amount: session.balance, currency: session.currency };
  }

  function success(body) {
    return { status: { statusCode: 'SUCCESS' }, ...body };
  }

  function error(code, message) {
    return { error: { code, message } };
  }

  function storeReplayRound(sessionID, round) {
    const event = `${sessionID}-${round.roundID}`;
    replayStore.set(event, {
      game: gameId,
      version: replayVersion,
      mode: 'base',
      round: {
        amount: round.amount,
        payout: round.payout,
        payoutMultiplier: round.payoutMultiplier,
        active: false,
        mode: round.mode || 'BASE',
        state: round.state,
      },
    });
    return event;
  }

  function handleRgsRequest(pathname, body) {
    const sessionID = body?.sessionID || 'local-demo';

    if (pathname === '/wallet/authenticate') {
      if (body?._mock?.err_is) {
        return error('ERR_IS', 'Mock session expired');
      }

      const session = getSession(sessionID);
      const jurisdiction = { ...DEFAULT_JURISDICTION };
      const mockProfile = body?._mock?.jurisdiction;
      if (mockProfile && JURISDICTION_MOCK[mockProfile]) {
        Object.assign(jurisdiction, JURISDICTION_MOCK[mockProfile]);
      }

      const round = session.activeRound ?? session.lastCompletedRound ?? null;

      return success({
        balance: balanceObject(session),
        config: {
          gameID: gameId,
          ...betConfig,
          jurisdiction,
        },
        round,
        meta: { lastEvent: session.lastEvent },
      });
    }

    if (pathname === '/wallet/balance') {
      const session = getSession(sessionID);
      return success({ balance: balanceObject(session) });
    }

    if (pathname === '/wallet/play') {
      const session = getSession(sessionID);
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return error('ERR_VAL', 'Invalid bet amount');
      }
      if (session.activeRound?.active) {
        return error('ERR_BE', 'Round already active');
      }
      if (session.balance < amount) {
        return error('ERR_IPB', 'Insufficient balance');
      }

      const playResult = resolvePlay(session, body);
      if (playResult?.error) {
        return playResult;
      }

      session.balance -= amount;
      session.roundID += 1;
      session.activeRound = {
        roundID: session.roundID,
        amount,
        ...playResult,
        active: true,
        mode: body.mode || 'BASE',
      };

      return success({
        balance: balanceObject(session),
        round: session.activeRound,
      });
    }

    if (pathname === '/wallet/end-round') {
      const session = getSession(sessionID);
      const round = session.activeRound;
      if (!round?.active) {
        return success({ balance: balanceObject(session) });
      }

      session.balance += round.payout;
      const replayEvent = storeReplayRound(sessionID, round);
      round.active = false;
      session.lastCompletedRound = {
        roundID: round.roundID,
        amount: round.amount,
        payout: round.payout,
        payoutMultiplier: round.payoutMultiplier,
        active: false,
        mode: round.mode,
        state: round.state,
      };
      session.lastEvent = null;
      session.activeRound = null;

      return success({ balance: balanceObject(session), replayEvent });
    }

    return null;
  }

  function handleBetEvent(body) {
    const sessionID = body?.sessionID || 'local-demo';
    const event = body?.event;
    if (event === undefined || event === null || event === '') {
      return error('ERR_VAL', 'Missing event');
    }
    const session = getSession(sessionID);
    session.lastEvent = String(event);
    return success({ event: String(event) });
  }

  function handleBetAction(body) {
    const sessionID = body?.sessionID || 'local-demo';
    const action = body?.action;
    if (!action || typeof action !== 'string') {
      return error('ERR_VAL', 'Missing action');
    }

    const session = getSession(sessionID);
    const round = session.activeRound;
    if (!round?.active) {
      return error('ERR_VAL', 'No active round for bet/action');
    }

    if (resolveAction) {
      const result = resolveAction(session, body);
      if (result?.error) return result;
      if (result && typeof result === 'object') {
        Object.assign(round, result);
      }
    }

    return success({
      balance: balanceObject(session),
      action: round,
    });
  }

  function handleReplayRequest(game, version, mode, event, amountQuery) {
    const modeNorm = String(mode || '').toLowerCase();
    if (game !== gameId || version !== replayVersion || modeNorm !== 'base') {
      return error('ERR_VAL', 'Invalid replay route');
    }
    if (!event) {
      return error('ERR_VAL', 'Missing replay event');
    }

    const stored = replayStore.get(event);
    if (stored) {
      return success({ round: stored.round });
    }

    const resolved = resolveReplay(event, amountQuery, { replayStore });
    if (resolved?.error) {
      return resolved;
    }
    if (resolved?.round) {
      return success({ round: resolved.round });
    }

    return error('ERR_BNF', 'Replay not found');
  }

  return {
    handleRgsRequest,
    handleBetEvent,
    handleBetAction,
    handleReplayRequest,
  };
}
