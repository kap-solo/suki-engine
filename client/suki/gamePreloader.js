import { preloadAssets, sleep } from './assetLoader.js';
import { isFatalRgsError } from './rgsGate.js';

const STYLE_ID = 'suki-game-preloader-styles';

const PRELOADER_CSS = `
.suki-game-preloader {
  position: absolute;
  inset: 0;
  z-index: 9200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: #1a1a1a;
  touch-action: manipulation;
}
.suki-game-preloader[hidden] {
  display: none !important;
}
.suki-game-preloader-panel {
  width: min(18rem, 88vw);
  text-align: center;
  pointer-events: none;
}
.suki-game-preloader-brand {
  margin: 0 0 0.35rem;
  font: 700 clamp(1.35rem, 6vw, 2rem) / 1.1 system-ui, sans-serif;
  color: #f0f0f0;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.suki-game-preloader-subtitle {
  margin: 0 0 1.35rem;
  color: #8a8a8a;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
}
.suki-game-preloader-track {
  height: 0.45rem;
  border-radius: 999px;
  background: #2e2e2e;
  overflow: hidden;
}
.suki-game-preloader-fill {
  height: 100%;
  width: 0%;
  border-radius: inherit;
  background: #e85d04;
  transition: width 0.18s ease-out;
}
.suki-game-preloader-hint {
  margin: 0.85rem 0 0;
  color: #7a7a7a;
  font-size: 0.78rem;
  line-height: 1.4;
  letter-spacing: 0.02em;
}
.suki-game-preloader--ready {
  cursor: pointer;
}
.suki-game-preloader--fatal {
  cursor: default;
}
.suki-game-preloader--fatal .suki-game-preloader-track {
  display: none;
}
.suki-game-preloader-error {
  margin: 0.85rem 0 0;
  color: #f87171;
  font-size: 0.82rem;
  line-height: 1.45;
  letter-spacing: 0.02em;
  text-wrap: balance;
}
.suki-stake-shell.suki-preloader-fatal > :not(.suki-game-preloader) {
  visibility: hidden;
  pointer-events: none;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = PRELOADER_CSS;
  document.head.appendChild(el);
}

const NOOP_PRELOADER = {
  isDismissed: () => true,
  isLoaded: () => true,
  isFatal: () => false,
  ready: Promise.resolve(),
  dismiss() {},
  show() {},
  destroy() {},
};

/**
 * Branded loading screen with asset preload progress, then tap-to-continue.
 *
 * @param {object} options
 * @param {HTMLElement} options.shell — `.suki-stake-shell`
 * @param {string} [options.brand]
 * @param {string} [options.subtitle] — e.g. game title
 * @param {string} [options.hint]
 * @param {string} [options.loadingHint]
 * @param {import('./assetLoader.js').PreloadAsset[]} [options.assets]
 * @param {number} [options.minDisplayMs]
 * @param {string} [options.connectingHint] — shown while bootstrap runs
 * @param {() => { ok: boolean, message?: string }} [options.gate] — sync launch validation
 * @param {() => void | Promise<void>} [options.bootstrap] — authenticate before continue
 * @param {() => void} [options.onContinue]
 * @param {boolean} [options.skip] — skip overlay (e.g. replay mode)
 */
export function createGamePreloader(options) {
  const {
    shell,
    brand = 'SUKI engine',
    subtitle = '',
    hint = 'Tap anywhere to play',
    loadingHint = 'Loading…',
    connectingHint = 'Connecting…',
    assets = [],
    minDisplayMs = 400,
    gate,
    bootstrap,
    onContinue,
    skip = false,
  } = options;

  if (typeof document === 'undefined' || !shell || skip) {
    return NOOP_PRELOADER;
  }

  ensureStyles();

  let dismissed = false;
  let loaded = false;
  let fatal = false;

  const overlay = document.createElement('div');
  overlay.className = 'suki-game-preloader';
  overlay.setAttribute('tabindex', '0');

  const panel = document.createElement('div');
  panel.className = 'suki-game-preloader-panel';

  const brandEl = document.createElement('h1');
  brandEl.className = 'suki-game-preloader-brand';
  brandEl.textContent = brand;

  const subtitleEl = document.createElement('p');
  subtitleEl.className = 'suki-game-preloader-subtitle';
  subtitleEl.textContent = subtitle;
  subtitleEl.hidden = !subtitle;

  const track = document.createElement('div');
  track.className = 'suki-game-preloader-track';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', '0');

  const fill = document.createElement('div');
  fill.className = 'suki-game-preloader-fill';
  track.appendChild(fill);

  const hintEl = document.createElement('p');
  hintEl.className = 'suki-game-preloader-hint';
  hintEl.textContent = loadingHint;

  const errorEl = document.createElement('p');
  errorEl.className = 'suki-game-preloader-error';
  errorEl.hidden = true;

  panel.append(brandEl, subtitleEl, track, hintEl, errorEl);
  overlay.appendChild(panel);
  shell.appendChild(overlay);
  shell.classList.add('suki-preloader-active');
  overlay.setAttribute('aria-label', loadingHint);

  function setProgress(percent) {
    const clamped = Math.max(0, Math.min(100, percent));
    fill.style.width = `${clamped}%`;
    track.setAttribute('aria-valuenow', String(clamped));
  }

  function markFatal(message) {
    fatal = true;
    loaded = false;
    setProgress(0);
    hintEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = message;
    overlay.setAttribute('aria-label', message);
    overlay.classList.remove('suki-game-preloader--ready');
    overlay.classList.add('suki-game-preloader--fatal');
    shell.classList.add('suki-preloader-fatal');
  }

  function markReady() {
    loaded = true;
    setProgress(100);
    hintEl.textContent = hint;
    overlay.setAttribute('aria-label', hint);
    overlay.classList.add('suki-game-preloader--ready');
  }

  function dismiss() {
    if (dismissed || !loaded || fatal) return;
    dismissed = true;
    overlay.hidden = true;
      shell.classList.remove('suki-preloader-active');
      shell.classList.remove('suki-preloader-fatal');
      onContinue?.();
  }

  function onPointerDown(event) {
    if (!loaded || fatal) return;
    event.preventDefault();
    dismiss();
  }

  function onKeyDown(event) {
    if (!loaded || fatal) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dismiss();
    }
  }

  overlay.addEventListener('pointerdown', onPointerDown);
  overlay.addEventListener('keydown', onKeyDown);

  const ready = (async () => {
    const started = Date.now();
    setProgress(0);

    if (gate) {
      const result = gate();
      if (!result?.ok) {
        markFatal(result.message ?? 'Unable to connect.');
        return;
      }
    }

    try {
      const preloadPromise = preloadAssets(assets, setProgress);
      if (bootstrap) {
        hintEl.textContent = connectingHint;
        overlay.setAttribute('aria-label', connectingHint);
        await Promise.all([preloadPromise, bootstrap()]);
      } else {
        await preloadPromise;
      }
    } catch (err) {
      console.error('[Suki] preloader bootstrap failed', err);
      const message =
        (isFatalRgsError(err) && err.playerMessage) ||
        err?.playerMessage ||
        (typeof err?.message === 'string' && !err.message.startsWith('ERR_')
          ? err.message
          : 'Unable to connect — game connection settings are invalid. Reopen the game from Stake.');
      markFatal(message);
      return;
    }

    const elapsed = Date.now() - started;
    if (elapsed < minDisplayMs) {
      await sleep(minDisplayMs - elapsed);
    }
    markReady();
  })();

  ready.catch((err) => {
    console.error('[Suki] preloader failed', err);
    markFatal(
      err?.playerMessage ??
        'Unable to connect — game connection settings are invalid. Reopen the game from Stake.',
    );
  });

  return {
    isDismissed: () => dismissed,
    isLoaded: () => loaded,
    isFatal: () => fatal,
    ready,
    dismiss,
    show() {
      if (dismissed) return;
      overlay.hidden = false;
      shell.classList.add('suki-preloader-active');
    },
    destroy() {
      overlay.removeEventListener('pointerdown', onPointerDown);
      overlay.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      shell.classList.remove('suki-preloader-active');
      shell.classList.remove('suki-preloader-fatal');
    },
  };
}
