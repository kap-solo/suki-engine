/**
 * Session elapsed timer — shown when jurisdiction.displaySessionTimer is true.
 */

/** @param {number} elapsedMs */
export function formatSessionElapsed(elapsedMs) {
  const totalSec = Math.floor(Math.max(0, elapsedMs) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * @param {object} options
 * @param {HTMLElement | null} options.element — displays elapsed time
 * @param {HTMLElement | null} [options.container] — wrapper hidden when timer off (e.g. HUD stat row)
 * @param {{ showSessionTimer?: boolean } | null} [options.controls] — createControlPolicy()
 * @param {() => boolean} [options.getVisible]
 * @param {number} [options.tickMs=1000]
 * @param {(elapsedMs: number) => string} [options.format]
 */
export function createSessionTimer(options) {
  const {
    element,
    container = null,
    controls = null,
    getVisible = () => controls?.showSessionTimer ?? false,
    tickMs = 1000,
    format = formatSessionElapsed,
  } = options;

  let startedAt = null;
  let intervalId = null;

  function elapsedMs() {
    if (startedAt == null) return 0;
    return Date.now() - startedAt;
  }

  function setNodeHidden(node, hidden) {
    if (node) node.hidden = hidden;
  }

  function render() {
    if (element) element.textContent = format(elapsedMs());
  }

  function stopTick() {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function startTick() {
    if (intervalId != null) return;
    intervalId = setInterval(render, tickMs);
  }

  /** Show/hide and start/stop based on jurisdiction. */
  function sync() {
    if (!element && !container) return;

    if (!getVisible()) {
      stopTick();
      setNodeHidden(container, true);
      setNodeHidden(element, true);
      return;
    }

    if (startedAt == null) {
      startedAt = Date.now();
    }
    setNodeHidden(container, false);
    setNodeHidden(element, false);
    render();
    startTick();
  }

  /** Reset elapsed time (e.g. new RGS session). */
  function reset() {
    startedAt = Date.now();
    render();
  }

  function destroy() {
    stopTick();
  }

  return {
    sync,
    reset,
    destroy,
    getElapsedMs: elapsedMs,
  };
}
