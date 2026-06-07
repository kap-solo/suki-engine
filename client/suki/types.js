/**
 * @typedef {object} BookEvent
 * @property {number} index
 * @property {string} type
 */

/**
 * @typedef {object} Round
 * @property {number} [roundID]
 * @property {number} amount
 * @property {number} [payout]
 * @property {number} [payoutMultiplier]
 * @property {boolean} [active]
 * @property {string} [mode]
 * @property {string} [event]
 * @property {BookEvent[]} [state]
 */

/**
 * @typedef {object} Balance
 * @property {number} amount — API units (1_000_000 = $1)
 * @property {string} currency
 */

/**
 * @typedef {object} JurisdictionFlags
 * @property {boolean} [socialCasino]
 * @property {boolean} [disabledFullscreen]
 * @property {boolean} [disabledTurbo]
 * @property {boolean} [disabledSuperTurbo]
 * @property {boolean} [disabledAutoplay]
 * @property {boolean} [disabledSlamstop]
 * @property {boolean} [disabledSpacebar]
 * @property {boolean} [disabledBuyFeature]
 * @property {boolean} [displayNetPosition]
 * @property {boolean} [displayRTP]
 * @property {boolean} [displaySessionTimer]
 * @property {number} [minimumRoundDuration]
 */

export {};
