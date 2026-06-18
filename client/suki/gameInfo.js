/**
 * Game info footer — Stake-required general disclaimer in paytable / info modals.
 */

/**
 * @param {HTMLElement} parent
 * @param {(key: string, vars?: Record<string, string | number>) => string} t
 */
export function appendGeneralDisclaimer(parent, t) {
  const block = document.createElement('div');
  block.className = 'suki-game-info-disclaimer';

  const title = document.createElement('p');
  title.className = 'suki-game-info-disclaimer-title';
  title.textContent = t('generalDisclaimerTitle');

  const text = document.createElement('p');
  text.className = 'suki-game-info-disclaimer-text';
  text.textContent = t('generalDisclaimer');

  block.append(title, text);
  parent.appendChild(block);
  return block;
}
