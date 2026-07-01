const STYLE_ID = 'suki-modal-host-styles';

const HOST_CSS = `
.suki-modal-overlay {
  position: absolute;
  inset: 0;
  z-index: 9100;
  pointer-events: auto;
}
.suki-modal-overlay[hidden] {
  display: none !important;
}
.suki-modal-scrim {
  position: absolute;
  inset: 0;
  background: rgba(4, 6, 10, 0.72);
}
.suki-modal-stage {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  pointer-events: none;
  z-index: 1;
}
.suki-modal-dialog {
  width: min(100%, 24rem);
  max-height: min(85%, 32rem);
  display: flex;
  flex-direction: column;
  border: 1px solid #334155;
  border-radius: 12px;
  background: #0d1118;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  pointer-events: auto;
}
.suki-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid #1f2733;
  background: #12161e;
}
.suki-modal-title {
  margin: 0;
  font: 700 0.95rem/1.2 system-ui, sans-serif;
  color: #e8edf4;
}
.suki-modal-close {
  padding: 0.25rem 0.45rem;
  border: 1px solid #2a3344;
  border-radius: 6px;
  background: #0a0c10;
  color: #9aa8bc;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.suki-modal-body {
  padding: 0.85rem 1rem 1rem;
  overflow: auto;
  color: #c5d0de;
  font-size: 0.88rem;
  line-height: 1.45;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = HOST_CSS;
  document.head.appendChild(el);
}

/**
 * @typedef {object} ModalDefinition
 * @property {string} title
 * @property {string} [content] — static HTML (sanitized by caller)
 * @property {(body: HTMLElement) => void} [render]
 */

/**
 * Modal overlay — darkens the full game shell; dialog centered inside the shell bounds.
 *
 * @param {object} options
 * @param {HTMLElement} options.root — `main.suki-stake-shell`
 * @param {HTMLElement | string} [options.centerIn] — unused; kept for API compat (modals use full shell)
 */
export function createModalHost(options) {
  const { root } = options;

  if (typeof document === 'undefined' || !root) {
    return {
      register() {},
      open() {},
      close() {},
      isOpen: () => false,
      destroy() {},
    };
  }

  ensureStyles();

  /** @type {Map<string, ModalDefinition>} */
  const registry = new Map();
  let openId = null;
  /** @type {ResizeObserver | null} */
  let resizeObserver = null;

  const overlay = document.createElement('div');
  overlay.className = 'suki-modal-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'presentation');

  const scrim = document.createElement('div');
  scrim.className = 'suki-modal-scrim';
  scrim.setAttribute('aria-hidden', 'true');

  const stage = document.createElement('div');
  stage.className = 'suki-modal-stage';

  const dialog = document.createElement('div');
  dialog.className = 'suki-modal-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'suki-modal-header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'suki-modal-title';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'suki-modal-close';
  closeBtn.textContent = 'Close';
  closeBtn.setAttribute('aria-label', 'Close');

  header.append(titleEl, closeBtn);

  const body = document.createElement('div');
  body.className = 'suki-modal-body';

  dialog.append(header, body);
  stage.appendChild(dialog);
  overlay.append(scrim, stage);
  root.appendChild(overlay);

  function positionStage() {
    stage.style.left = '0';
    stage.style.top = '0';
    stage.style.width = '100%';
    stage.style.height = '100%';
  }

  function startLayoutWatch() {
    positionStage();
    if (typeof ResizeObserver === 'undefined') return;
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => positionStage());
    resizeObserver.observe(root);
  }

  function stopLayoutWatch() {
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  function close() {
    openId = null;
    overlay.hidden = true;
    body.innerHTML = '';
    dialog.removeAttribute('aria-labelledby');
    root.classList.remove('suki-shell-modal-open');
    stopLayoutWatch();
  }

  function open(id) {
    const def = registry.get(String(id));
    if (!def) return;
    openId = String(id);
    titleEl.textContent = def.title;
    dialog.setAttribute('aria-labelledby', 'suki-modal-title');
    titleEl.id = 'suki-modal-title';
    body.innerHTML = '';
    if (def.render) {
      def.render(body);
    } else if (def.content) {
      body.innerHTML = def.content;
    }
    overlay.hidden = false;
    root.classList.add('suki-shell-modal-open');
    startLayoutWatch();
  }

  function onScrimClick() {
    close();
  }

  function onStageClick(event) {
    if (event.target === stage) close();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && openId) {
      event.preventDefault();
      close();
    }
  }

  function onResize() {
    if (openId) positionStage();
  }

  scrim.addEventListener('click', onScrimClick);
  stage.addEventListener('click', onStageClick);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);

  return {
    /** @param {string} id @param {ModalDefinition} def */
    register(id, def) {
      registry.set(String(id), def);
    },
    open,
    close,
    isOpen() {
      return openId !== null;
    },
    getOpenId() {
      return openId;
    },
    destroy() {
      scrim.removeEventListener('click', onScrimClick);
      stage.removeEventListener('click', onStageClick);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      overlay.remove();
      close();
    },
  };
}
