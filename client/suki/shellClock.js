/**
 * Wall clock — top-left of the Stake shell (24-hour HH:MM, no seconds).
 */

/** @param {Date} [date] */
export function formatShellClockTime(date = new Date()) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * @param {object} options
 * @param {HTMLElement} options.root — `main.suki-stake-shell`
 */
export function createShellClock(options) {
  const { root } = options;

  if (typeof document === 'undefined' || !root) {
    return { sync() {}, destroy() {} };
  }

  const el = document.createElement('time');
  el.className = 'suki-shell-clock';
  el.setAttribute('aria-label', 'Current time');
  root.appendChild(el);

  let timeoutId = null;
  let intervalId = null;

  function render() {
    const now = new Date();
    const text = formatShellClockTime(now);
    el.textContent = text;
    el.dateTime = text;
  }

  function clearTimers() {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function start() {
    clearTimers();
    render();
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
    timeoutId = setTimeout(() => {
      render();
      intervalId = setInterval(render, 60_000);
      timeoutId = null;
    }, Math.max(0, msToNextMinute));
  }

  start();

  return {
    element: el,
    sync: render,
    destroy() {
      clearTimers();
      el.remove();
    },
  };
}
