import { showDevTools } from './environment.js';
import { createScreenRegistry } from './stakeScreens.js';

const STYLE_ID = 'suki-screen-preview-styles';

const PREVIEW_CSS = `
.suki-screen-preview {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 0.5rem 1.25rem;
  background: #0b0d12;
}
.suki-screen-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.75rem;
  width: 100%;
  max-width: 100%;
  padding: 0.45rem 0.65rem;
  border: 1px solid #243044;
  border-radius: 8px;
  background: #12161e;
  color: #9aa8bc;
  font: 600 0.72rem/1.2 system-ui, sans-serif;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.suki-screen-toolbar label {
  color: #6f7f96;
}
.suki-screen-toolbar select {
  min-width: 9rem;
  padding: 0.3rem 0.45rem;
  border-radius: 6px;
  border: 1px solid #2a3344;
  background: #0a0c10;
  color: #e8edf4;
  font-size: 0.78rem;
  text-transform: none;
  letter-spacing: 0;
}
.suki-screen-meta {
  font-variant-numeric: tabular-nums;
  color: #7dd3fc;
  text-transform: none;
  letter-spacing: 0.02em;
}
.suki-screen-frame-wrap {
  display: flex;
  justify-content: center;
  width: 100%;
  overflow: auto;
}
.suki-screen-frame {
  flex: 0 0 auto;
  overflow: auto;
  border: 1px solid #334155;
  border-radius: 10px;
  background: #06080c;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}
.suki-screen-frame.suki-screen-window {
  width: 100%;
  max-width: none;
  border: none;
  border-radius: 0;
  box-shadow: none;
  overflow: visible;
}
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = PREVIEW_CSS;
  document.head.appendChild(el);
}

function formatSize(screen) {
  const logical = `${screen.width} × ${screen.height}`;
  if (screen.stakeWidth && screen.stakeHeight && (screen.devicePixelRatio ?? 1) > 1) {
    return `${logical} (Stake ${screen.stakeWidth}×${screen.stakeHeight} @${screen.devicePixelRatio}x)`;
  }
  return logical;
}

/**
 * Dev-only Stake screen preview — resizes the game root to official iframe dimensions.
 *
 * @param {object} options
 * @param {HTMLElement} options.root — game shell (e.g. main.layout)
 * @param {ReturnType<typeof createScreenRegistry>} [options.registry]
 * @param {import('./stakeScreens.js').StakeScreen[]} [options.extraScreens]
 * @param {boolean} [options.enabled]
 * @param {string | null} [options.initialScreenId] — defaults to ?screen= URL param
 * @param {(screen: import('./stakeScreens.js').StakeScreen | null) => void} [options.onScreenChange]
 */
export function initStakeScreenPreview(options) {
  const {
    root,
    extraScreens = [],
    enabled = showDevTools(),
    initialScreenId = null,
    onScreenChange = null,
  } = options;

  const registry = options.registry ?? createScreenRegistry(extraScreens);

  if (!enabled || typeof document === 'undefined' || !root?.parentElement) {
    return { destroy() {}, setScreen() {}, getScreen: () => null, registry };
  }

  ensureStyles();

  const preview = document.createElement('div');
  preview.className = 'suki-screen-preview';
  preview.setAttribute('data-suki-dev', '');

  const toolbar = document.createElement('div');
  toolbar.className = 'suki-screen-toolbar';

  const label = document.createElement('label');
  label.textContent = 'Stake screen';
  label.setAttribute('for', 'suki-screen-select');

  const select = document.createElement('select');
  select.id = 'suki-screen-select';

  const windowOption = document.createElement('option');
  windowOption.value = '';
  windowOption.textContent = 'Window (browser)';
  select.appendChild(windowOption);

  for (const screen of registry.screens) {
    const opt = document.createElement('option');
    opt.value = screen.id;
    opt.textContent = `${screen.label} (${formatSize(screen)})`;
    select.appendChild(opt);
  }

  const meta = document.createElement('span');
  meta.className = 'suki-screen-meta';

  toolbar.append(label, select, meta);

  const frameWrap = document.createElement('div');
  frameWrap.className = 'suki-screen-frame-wrap';

  const frame = document.createElement('div');
  frame.className = 'suki-screen-frame suki-screen-window';

  const parent = root.parentElement;
  parent.insertBefore(preview, root);
  preview.append(toolbar, frameWrap);
  frameWrap.append(frame);
  frame.append(root);

  /** @type {import('./stakeScreens.js').StakeScreen | null} */
  let activeScreen = null;

  function updateUrl(screenId) {
    const url = new URL(window.location.href);
    if (screenId) {
      url.searchParams.set('screen', screenId);
    } else {
      url.searchParams.delete('screen');
    }
    window.history.replaceState({}, '', url);
  }

  function applyScreen(screen) {
    activeScreen = screen;
    if (!screen) {
      frame.classList.add('suki-screen-window');
      frame.style.width = '';
      frame.style.height = '';
      meta.textContent = 'Full browser viewport';
      select.value = '';
    } else {
      frame.classList.remove('suki-screen-window');
      frame.style.width = `${screen.width}px`;
      frame.style.height = `${screen.height}px`;
      meta.textContent = formatSize(screen);
      select.value = screen.id;
    }
    onScreenChange?.(screen);
    window.dispatchEvent(new Event('resize'));
  }

  function setScreen(id) {
    if (!id) {
      updateUrl(null);
      applyScreen(null);
      return;
    }
    const screen = registry.get(id);
    if (!screen) return;
    updateUrl(screen.id);
    applyScreen(screen);
  }

  function onSelectChange() {
    setScreen(select.value || null);
  }

  select.addEventListener('change', onSelectChange);

  const startId = initialScreenId ?? registry.resolveIdFromUrl();
  if (startId) {
    applyScreen(registry.get(startId));
    updateUrl(startId);
  } else {
    applyScreen(null);
  }

  return {
    registry,
    destroy() {
      select.removeEventListener('change', onSelectChange);
      if (root.parentElement === frame) {
        preview.parentElement?.insertBefore(root, preview);
      }
      preview.remove();
      applyScreen(null);
    },
    setScreen,
    getScreen: () => activeScreen,
  };
}

export { STAKE_SCREENS, createScreenRegistry } from './stakeScreens.js';
