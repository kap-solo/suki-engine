import { preloadAssets, sleep } from './assetLoader.js';

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
.suki-stake-shell.suki-preloader-active {
  overflow: hidden;
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
    assets = [],
    minDisplayMs = 400,
    onContinue,
    skip = false,
  } = options;

  if (typeof document === 'undefined' || !shell || skip) {
    return NOOP_PRELOADER;
  }

  ensureStyles();

  let dismissed = false;
  let loaded = false;

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

  panel.append(brandEl, subtitleEl, track, hintEl);
  overlay.appendChild(panel);
  shell.appendChild(overlay);
  shell.classList.add('suki-preloader-active');
  overlay.setAttribute('aria-label', loadingHint);

  function setProgress(percent) {
    const clamped = Math.max(0, Math.min(100, percent));
    fill.style.width = `${clamped}%`;
    track.setAttribute('aria-valuenow', String(clamped));
  }

  function markReady() {
    loaded = true;
    setProgress(100);
    hintEl.textContent = hint;
    overlay.setAttribute('aria-label', hint);
    overlay.classList.add('suki-game-preloader--ready');
  }

  function dismiss() {
    if (dismissed || !loaded) return;
    dismissed = true;
    overlay.hidden = true;
    shell.classList.remove('suki-preloader-active');
    onContinue?.();
  }

  function onPointerDown(event) {
    if (!loaded) return;
    event.preventDefault();
    dismiss();
  }

  function onKeyDown(event) {
    if (!loaded) return;
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
    await preloadAssets(assets, setProgress);
    const elapsed = Date.now() - started;
    if (elapsed < minDisplayMs) {
      await sleep(minDisplayMs - elapsed);
    }
    markReady();
  })();

  ready.catch((err) => {
    console.error('[Suki] preloader failed', err);
    markReady();
  });

  return {
    isDismissed: () => dismissed,
    isLoaded: () => loaded,
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
    },
  };
}
