/**
 * Player currency — URL param before auth, balance.currency after authenticate.
 */

/** @type {string | null} */
let playerCurrency = null;

/** @param {string} currency */
export function setPlayerCurrency(currency) {
  playerCurrency = currency || null;
}

/**
 * @param {string} [urlFallback='USD']
 */
export function getPlayerCurrency(urlFallback = 'USD') {
  return playerCurrency ?? urlFallback;
}

export function clearPlayerCurrency() {
  playerCurrency = null;
}
