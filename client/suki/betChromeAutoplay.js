/**
 * Shared autoplay bet-control sync — stop flash, pending state, progress label.
 */

const FLASH_MS = 320;

/**
 * @param {HTMLButtonElement} button
 */
export function flashAutoplayStopClick(button) {
  if (!button) return;
  button.classList.remove('suki-autoplay-btn--stop-flash');
  void button.offsetWidth;
  button.classList.add('suki-autoplay-btn--stop-flash');
  window.setTimeout(() => button.classList.remove('suki-autoplay-btn--stop-flash'), FLASH_MS);
}

/**
 * @param {object} options
 * @param {HTMLButtonElement} options.button
 * @param {HTMLElement | null | undefined} [options.cluster]
 * @param {HTMLElement | null | undefined} [options.panel]
 * @param {HTMLElement | null | undefined} [options.progressEl]
 * @param {boolean} options.autoplaying
 * @param {boolean} options.stopPending
 * @param {boolean} options.stopMode — show ■ icon
 * @param {string} [options.stopLabel]
 * @param {{ current: number, total: number }} [options.progress]
 * @param {boolean} options.disabled
 * @param {string} [options.playLabel]
 * @param {string} [options.stopActionLabel]
 * @param {string} [options.stoppingActionLabel]
 */
export function syncAutoplayBetControl(options) {
  const {
    button,
    cluster,
    panel,
    progressEl,
    autoplaying,
    stopPending,
    stopMode,
    stopLabel = 'Stopping…',
    progress = { current: 0, total: 0 },
    disabled,
    playLabel = 'Autoplay',
    stopActionLabel = 'Stop autoplay',
    stoppingActionLabel = 'Stopping autoplay after this spin',
  } = options;

  button.classList.toggle('suki-autoplay-btn--stop', stopMode);
  button.classList.toggle('suki-autoplay-btn--stop-pending', stopPending);
  cluster?.classList.toggle('suki-autoplay-cluster--stop-pending', stopPending);
  panel?.classList.toggle('suki-autoplay-panel--stop-pending', stopPending);

  button.disabled = disabled;
  button.setAttribute(
    'aria-label',
    stopPending ? stoppingActionLabel : stopMode ? stopActionLabel : playLabel,
  );

  if (!progressEl) return;

  if (stopMode && stopPending) {
    progressEl.hidden = false;
    progressEl.textContent = stopLabel;
    progressEl.classList.add('suki-autoplay-progress--pending');
  } else if (stopMode && progress.total > 0) {
    progressEl.hidden = false;
    progressEl.textContent = `${progress.current} / ${progress.total}`;
    progressEl.classList.remove('suki-autoplay-progress--pending');
  } else {
    progressEl.hidden = true;
    progressEl.textContent = '';
    progressEl.classList.remove('suki-autoplay-progress--pending');
  }
}
