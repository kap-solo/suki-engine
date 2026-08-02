/**
 * Dev toolbar helpers — social mode toggle for ?dev=true previews.
 */

import { showDevTools } from './environment.js';
import { toggleDevSocialCasinoMode } from './devSocialMode.js';

const STYLE_ID = 'suki-dev-toolbar-styles';

const TOOLBAR_CSS = `
.dev-toolbar {
  position: fixed;
  top: max(0.5rem, env(safe-area-inset-top, 0px));
  left: max(0.5rem, env(safe-area-inset-left, 0px));
  z-index: 11;
  display: flex;
  gap: 0.35rem;
  pointer-events: none;
}
.dev-toolbar-btn {
  border: 1px solid #3d5a80;
  border-radius: 8px;
  padding: 0.38rem 0.62rem;
  background: rgba(12, 20, 34, 0.92);
  color: #b8d4ff;
  font: 700 0.68rem/1.2 'Manrope', system-ui, sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  pointer-events: auto;
  backdrop-filter: blur(4px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
}
.dev-toolbar-btn:hover:not(:disabled) {
  background: rgba(18, 30, 50, 0.96);
  border-color: #5a8fd4;
  color: #e8f2ff;
}
.dev-toolbar-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dev-toolbar-btn--active {
  border-color: #6eb6ff;
  background: rgba(24, 44, 72, 0.96);
  color: #f0f8ff;
}
.dev-toolbar-replay {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  pointer-events: none;
}
.dev-toolbar-spin-id {
  max-width: min(12rem, 36vw);
  padding: 0.28rem 0.45rem;
  border: 1px solid #2a3a52;
  border-radius: 6px;
  background: rgba(8, 12, 18, 0.88);
  color: #9aa8bc;
  font: 600 0.62rem/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: auto;
}
.suki-stake-shell[data-suki-screen='popout-s'] .dev-toolbar-spin-id {
  max-width: min(7rem, 28vw);
  padding: 0.22rem 0.35rem;
  font-size: 0.54rem;
}
.suki-stake-shell[data-suki-screen='popout-s'] .dev-toolbar-btn {
  padding: 0.28rem 0.48rem;
  font-size: 0.58rem;
  border-radius: 6px;
}
`;

export function ensureDevToolbarStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = TOOLBAR_CSS;
  document.head.appendChild(el);
}

/**
 * @param {HTMLElement} toolbar
 * @param {object} options
 * @param {() => boolean} [options.getSocialCasino]
 * @param {(enabled: boolean) => void} [options.onSocialCasinoChange]
 * @param {() => { socialCasino?: boolean } | null | undefined} [options.getJurisdictionState]
 * @returns {{ button: HTMLButtonElement, sync: (state: { visible?: boolean, socialCasino?: boolean }) => void }}
 */
export function mountDevSocialModeToggle(toolbar, {
  getSocialCasino,
  onSocialCasinoChange,
  getJurisdictionState,
} = {}) {
  ensureDevToolbarStyles();

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dev-toolbar-btn dev-toolbar-btn--social';
  button.textContent = 'Social Mode';
  button.title = 'Toggle Stake.US-style copy (Earn, Get Bonus, etc.)';
  button.setAttribute('aria-label', 'Toggle social casino mode');
  button.setAttribute('aria-pressed', 'false');
  button.hidden = true;

  button.addEventListener('click', () => {
    const next = toggleDevSocialCasinoMode(getJurisdictionState?.() ?? null);
    onSocialCasinoChange?.(next);
  });

  toolbar.appendChild(button);

  return {
    button,
    sync({ visible = false, socialCasino = getSocialCasino?.() ?? false } = {}) {
      const show = visible && showDevTools();
      button.hidden = !show;
      button.disabled = !show;
      button.setAttribute('aria-pressed', socialCasino ? 'true' : 'false');
      button.classList.toggle('dev-toolbar-btn--active', socialCasino);
      button.title = socialCasino
        ? 'Social mode on — Stake.US copy (click to switch to real-money labels)'
        : 'Social mode off — real-money copy (click to switch to Stake.US labels)';
    },
  };
}

/**
 * Empty dev toolbar shell — games append Feature/Replay then mountDevSocialModeToggle().
 *
 * @param {HTMLElement | null} shellEl
 */
export function createDevToolbarShell(shellEl) {
  const noop = {
    sync() {},
    destroy() {},
    el: null,
  };
  if (!shellEl) return noop;

  ensureDevToolbarStyles();

  const toolbar = document.createElement('div');
  toolbar.className = 'dev-toolbar';
  toolbar.dataset.sukiDev = '';
  toolbar.hidden = true;
  shellEl.appendChild(toolbar);

  return {
    el: toolbar,
    destroy() {
      toolbar.remove();
    },
  };
}
