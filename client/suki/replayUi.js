/**
 * Replay chrome — Stake checklist: not a live bet, play amount, multiplier, final amount.
 */

/**
 * Mark the shell and replay banner as active replay mode.
 *
 * @param {object} options
 * @param {HTMLElement | null} [options.shell]
 * @param {HTMLElement | null} [options.banner]
 * @param {HTMLElement | null} [options.noteEl]
 * @param {ReturnType<import('./copy.js').createCopyPolicy>} options.copy
 */
export function applyReplayModeChrome({ shell, banner, noteEl, copy }) {
  if (shell) {
    shell.dataset.sukiReplay = 'true';
  }
  if (banner) {
    banner.hidden = false;
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    const label = banner.querySelector('.replay-label');
    if (label) {
      label.textContent = copy.t('replayModeTitle');
    }
  }
  if (noteEl) {
    noteEl.textContent = copy.t('replayDisclaimer');
  }
}

/**
 * @param {ReturnType<import('./copy.js').createCopyPolicy>} copy
 * @param {{ playAmount: number, payoutMultiplier: number, finalAmount: number }} amounts — display units
 * @param {{ formatCurrency?: (n: number) => string, formatBalance?: (n: number) => string, formatWin?: (n: number) => string, formatMult: (n: number) => string }} fmt
 */
export function formatReplayStartSummary(copy, amounts, fmt) {
  const { playAmount, payoutMultiplier, finalAmount } = amounts;
  const formatBalance = fmt.formatBalance ?? fmt.formatCurrency ?? ((n) => String(n));
  const formatWin = fmt.formatWin ?? fmt.formatCurrency ?? ((n) => String(n));
  const roundSummary = copy.t('replayStartSummary', {
    playLabel: copy.t('replayPlayLabel'),
    playAmount: formatBalance(playAmount),
    worthLabel: copy.t('payoutMultiplierLabel'),
    worthMult: fmt.formatMult(payoutMultiplier),
    finalLabel: copy.t('replayFinalAmountLabel'),
    finalAmount: formatWin(finalAmount),
  });
  return `${copy.t('replayDisclaimer')} ${roundSummary}`;
}
