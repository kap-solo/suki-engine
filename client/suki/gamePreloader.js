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
  background: rgba(4, 6, 10, 0.94);
  cursor: pointer;
  touch-action: manipulation;
}
.suki-game-preloader[hidden] {
  display: none !important;
}
.suki-game-preloader-panel {
  max-width: 20rem;
  text-align: center;
  pointer-events: none;
}
.suki-game-preloader-title {
  margin: 0 0 0.65rem;
  font: 700 clamp(1.25rem, 5vw, 1.75rem) / 1.15 system-ui, sans-serif;
  color: #e8edf4;
  letter-spacing: 0.02em;
}
.suki-game-preloader-hint {
  margin: 0;
  color: #8b97a8;
  font-size: 0.9rem;
  line-height: 1.4;
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

/**
 * Tap-to-continue preloader — unlocks audio and starts the game on first interaction.
 *
 * @param {object} options
 * @param {HTMLElement} options.shell — `.suki-stake-shell`
 * @param {string} [options.title]
 * @param {string} [options.hint]
 * @param {() => void} [options.onContinue]
 * @param {boolean} [options.skip] — skip overlay (e.g. replay mode)
 */
export function createGamePreloader(options) {
  const {
    shell,
    title = 'Loading',
    hint = 'Tap anywhere to play',
    onContinue,
    skip = false,
  } = options;

  if (typeof document === 'undefined' || !shell) {
    return {
      isDismissed: () => true,
      dismiss() {},
      show() {},
      destroy() {},
    };
  }

  if (skip) {
    return {
      isDismissed: () => true,
      dismiss() {},
      show() {},
      destroy() {},
    };
  }

  ensureStyles();

  let dismissed = false;

  const overlay = document.createElement('div');
  overlay.className = 'suki-game-preloader';
  overlay.setAttribute('role', 'button');
  overlay.setAttribute('tabindex', '0');
  overlay.setAttribute('aria-label', hint);

  const panel = document.createElement('div');
  panel.className = 'suki-game-preloader-panel';

  const titleEl = document.createElement('h2');
  titleEl.className = 'suki-game-preloader-title';
  titleEl.textContent = title;

  const hintEl = document.createElement('p');
  hintEl.className = 'suki-game-preloader-hint';
  hintEl.textContent = hint;

  panel.append(titleEl, hintEl);
  overlay.appendChild(panel);
  shell.appendChild(overlay);
  shell.classList.add('suki-preloader-active');

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    overlay.hidden = true;
    shell.classList.remove('suki-preloader-active');
    onContinue?.();
  }

  function onPointerDown(event) {
    event.preventDefault();
    dismiss();
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dismiss();
    }
  }

  overlay.addEventListener('pointerdown', onPointerDown);
  overlay.addEventListener('keydown', onKeyDown);

  return {
    isDismissed: () => dismissed,
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
