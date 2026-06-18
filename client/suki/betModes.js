/**
 * Bet mode policy — merges math bundle modes with RGS authenticate betModes.
 * Ready for BASE, activate (ante), and buy (bonus) when math + auth provide them.
 */

/**
 * @typedef {object} GameModeSpec
 * @property {string} name — math bundle key (base, bonus)
 * @property {number} [cost=1]
 */

/**
 * @typedef {'default' | 'activate' | 'buy'} BetModeType
 */

/** @param {string | null | undefined} key */
export function normalizeModeKey(key) {
  return String(key ?? 'base').trim().toLowerCase();
}

/** @param {string} key */
export function toRgsMode(key) {
  return normalizeModeKey(key).toUpperCase();
}

/**
 * Read modes from math `index.json`.
 * @param {{ modes?: Array<{ name: string, cost?: number }> } | null | undefined} index
 * @returns {GameModeSpec[]}
 */
export function parseGameModesFromIndex(index) {
  if (!index?.modes?.length) {
    return [{ name: 'base', cost: 1 }];
  }
  return index.modes.map((m) => ({
    name: normalizeModeKey(m.name),
    cost: m.cost ?? 1,
  }));
}

/**
 * @param {Record<string, object>} authBetModes
 * @param {string} key
 */
function findAuthEntry(authBetModes, key) {
  const norm = normalizeModeKey(key);
  for (const [authKey, cfg] of Object.entries(authBetModes ?? {})) {
    const cfgKey = normalizeModeKey(cfg?.mode ?? authKey);
    if (cfgKey === norm) {
      return { authKey, cfg };
    }
  }
  return null;
}

/**
 * @param {{ feature?: boolean, costMultiplier?: number }} mode
 * @returns {BetModeType}
 */
function inferModeType({ feature, costMultiplier }) {
  if (feature) return 'buy';
  if ((costMultiplier ?? 1) > 1) return 'activate';
  return 'default';
}

/**
 * @param {Record<string, object>} authBetModes
 * @param {GameModeSpec[]} gameModes
 */
function buildCatalog(authBetModes, gameModes) {
  const gameList = gameModes?.length ? gameModes : [{ name: 'base', cost: 1 }];
  const hasAuth = !!authBetModes && Object.keys(authBetModes).length > 0;

  return gameList.map((gm) => {
    const key = normalizeModeKey(gm.name);
    const auth = hasAuth ? findAuthEntry(authBetModes, key) : null;
    const cfg = auth?.cfg ?? {};
    const mathCost = gm.cost ?? 1;
    const costMultiplier = cfg.costMultiplier ?? mathCost;
    const feature = !!cfg.feature;

    return {
      key,
      rgsMode: toRgsMode(cfg.mode ?? key),
      mathCost,
      costMultiplier,
      feature,
      type: inferModeType({ feature, costMultiplier }),
      authKey: auth?.authKey ?? null,
    };
  });
}

/**
 * @param {object} [options]
 * @param {Record<string, object>} [options.authBetModes] — config.betModes from authenticate
 * @param {GameModeSpec[]} [options.gameModes] — from math index.json
 * @param {{ canBuyFeature?: boolean } | null} [options.controls] — createControlPolicy()
 * @param {string} [options.defaultMode='base']
 * @param {string | null} [options.replayMode] — URL replay mode when in replay
 */
export function createBetModePolicy(options = {}) {
  const {
    authBetModes = {},
    gameModes = [{ name: 'base', cost: 1 }],
    controls = null,
    defaultMode = 'base',
    replayMode = null,
  } = options;

  const catalog = buildCatalog(authBetModes, gameModes);
  const byKey = new Map(catalog.map((m) => [m.key, m]));

  let activeKey =
    replayMode != null ? normalizeModeKey(replayMode) : normalizeModeKey(defaultMode);
  if (!byKey.has(activeKey)) {
    activeKey = catalog[0]?.key ?? 'base';
  }

  function getActiveMode() {
    return byKey.get(activeKey) ?? catalog[0];
  }

  function canSelectMode(key) {
    const k = normalizeModeKey(key);
    const mode = byKey.get(k);
    if (!mode) return false;
    if (mode.type === 'buy' && controls && !controls.canBuyFeature) return false;
    return true;
  }

  return {
    get modes() {
      return catalog;
    },
    get activeKey() {
      return activeKey;
    },
    getActiveMode,
    /**
     * @param {string} key
     * @returns {boolean}
     */
    setActiveMode(key) {
      const k = normalizeModeKey(key);
      if (!canSelectMode(k)) return false;
      activeKey = k;
      return true;
    },
    rgsModeForPlay() {
      return getActiveMode().rgsMode;
    },
    replayModeKey() {
      return getActiveMode().key;
    },
    /**
     * RGS debit = base bet API amount × active mode cost multiplier.
     * @param {number} baseBetApi
     */
    playAmountApi(baseBetApi) {
      const mult = getActiveMode().costMultiplier ?? 1;
      return Math.round(baseBetApi * mult);
    },
    /**
     * Recover chip/base bet from a debited play amount (round.amount).
     * @param {number} playAmountApi
     * @param {string} [rgsMode] — round.mode from RGS (e.g. BASE, BONUS)
     */
    baseBetApiFromPlayAmount(playAmountApi, rgsMode) {
      let mult = 1;
      if (rgsMode) {
        const norm = toRgsMode(rgsMode);
        const entry = catalog.find((m) => m.rgsMode === norm);
        mult = entry?.costMultiplier ?? 1;
      } else {
        mult = getActiveMode().costMultiplier ?? 1;
      }
      return Math.round(playAmountApi / mult);
    },
    canSelectMode,
    canBuyFeature() {
      return controls?.canBuyFeature ?? true;
    },
    buyModes() {
      return catalog.filter((m) => m.type === 'buy');
    },
    activateModes() {
      return catalog.filter((m) => m.type === 'activate');
    },
    baseMode() {
      return byKey.get('base') ?? catalog.find((m) => m.type === 'default') ?? catalog[0];
    },
    /**
     * @param {string} [key]
     */
    isBuyMode(key = activeKey) {
      return byKey.get(normalizeModeKey(key))?.type === 'buy';
    },
    /**
     * @param {string} [key]
     */
    isActivateMode(key = activeKey) {
      return byKey.get(normalizeModeKey(key))?.type === 'activate';
    },
  };
}

/**
 * Align bet mode selector with an active authenticate round.
 *
 * @param {object | null | undefined} round
 * @param {ReturnType<typeof createBetModePolicy>} policy
 */
export function applyBetModeFromRound(round, policy) {
  if (!round?.active || !round.mode || !policy) return false;

  const target = toRgsMode(round.mode);
  const entry = policy.modes.find((mode) => mode.rgsMode === target);
  if (!entry || !policy.canSelectMode(entry.key)) return false;
  return policy.setActiveMode(entry.key);
}
