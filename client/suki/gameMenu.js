/**
 * Burger menu — modals, toggles, and pop-up panel chrome.
 */

/** @typedef {'modal' | 'toggle' | 'volume' | 'separator' | 'action'} GameMenuItemType */

/**
 * @typedef {object} GameMenuItem
 * @property {GameMenuItemType} type
 * @property {string} [id]
 * @property {string} [label]
 * @property {'music' | 'sfx'} [pref] — toggle → audioPrefs key
 * @property {() => void} [action]
 * @property {() => boolean} [visible] — hide when false
 */

export const DEFAULT_GAME_MENU_ITEMS = [
  { type: 'modal', id: 'how-to-play', label: 'How to Play' },
  { type: 'modal', id: 'paytable', label: 'Paytable' },
  { type: 'modal', id: 'stats', label: 'Stats' },
  { type: 'modal', id: 'recent-results', label: 'Recent Results' },
  { type: 'separator' },
  { type: 'toggle', id: 'music', label: 'Music', pref: 'music' },
  { type: 'volume', id: 'music-volume', label: 'Music volume' },
  { type: 'toggle', id: 'sfx', label: 'Sound effects', pref: 'sfx' },
];

/**
 * @param {GameMenuItem[]} items
 * @param {object | null} game
 */
export function filterVisibleMenuItems(items, game) {
  return items.filter((item) => {
    if (item.type === 'separator') return true;
    if (typeof item.visible === 'function' && !item.visible(game)) return false;
    return true;
  });
}

/**
 * @param {object} options
 * @param {HTMLElement} options.brand — `.suki-brand`
 * @param {HTMLElement} options.shell — `.suki-stake-shell`
 * @param {ReturnType<import('./modalHost.js').createModalHost>} options.modalHost
 * @param {ReturnType<import('./audioPrefs.js').createAudioPrefs>} options.audioPrefs
 * @param {GameMenuItem[]} [options.items]
 */
export function createGameMenu(options) {
  const {
    brand,
    shell,
    modalHost,
    audioPrefs,
    items = DEFAULT_GAME_MENU_ITEMS,
  } = options;

  if (typeof document === 'undefined' || !brand || !shell) {
    return {
      elements: {},
      bind() {},
      setOpen() {},
      isOpen: () => false,
      refresh() {},
      destroy() {},
    };
  }

  /** @type {object | null} */
  let game = null;

  const wrap = document.createElement('div');
  wrap.className = 'suki-game-menu';
  wrap.dataset.sukiGameMenu = '';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'suki-game-menu-trigger';
  trigger.setAttribute('aria-label', 'Game menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-controls', 'suki-game-menu-popup');
  trigger.innerHTML = '<span class="suki-game-menu-bars" aria-hidden="true"></span>';

  const popup = document.createElement('nav');
  popup.id = 'suki-game-menu-popup';
  popup.className = 'suki-game-menu-popup';
  popup.hidden = true;
  popup.setAttribute('aria-label', 'Game options');

  const list = document.createElement('ul');
  list.className = 'suki-game-menu-list';

  popup.appendChild(list);
  wrap.appendChild(trigger);
  wrap.appendChild(popup);
  brand.appendChild(wrap);

  let open = false;

  function positionPopup() {
    const gap = 6;
    const pad = 8;
    const shellRect = shell.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const maxWidth = Math.min(264, Math.max(120, shellRect.width - pad * 2));
    const maxHeight = Math.floor(Math.max(120, shellRect.height - pad * 2));

    popup.style.left = 'auto';
    popup.style.right = '0';
    popup.style.top = `calc(100% + ${gap}px)`;
    popup.style.bottom = 'auto';
    popup.style.width = `${Math.round(maxWidth)}px`;
    popup.style.maxWidth = `${Math.round(maxWidth)}px`;
    popup.style.maxHeight = `${maxHeight}px`;

    let popupRect = popup.getBoundingClientRect();

    if (popupRect.left < shellRect.left + pad) {
      const left = Math.max(0, Math.round(shellRect.left + pad - wrapRect.left));
      popup.style.right = 'auto';
      popup.style.left = `${left}px`;
      popupRect = popup.getBoundingClientRect();
    } else if (popupRect.right > shellRect.right - pad) {
      const right = Math.max(0, Math.round(wrapRect.right - (shellRect.right - pad)));
      popup.style.left = 'auto';
      popup.style.right = `${right}px`;
      popupRect = popup.getBoundingClientRect();
    }

    if (popupRect.bottom > shellRect.bottom - pad) {
      popup.style.top = 'auto';
      popup.style.bottom = `calc(100% + ${gap}px)`;
      popupRect = popup.getBoundingClientRect();
    }
    if (popupRect.top < shellRect.top + pad) {
      popup.style.top = `${Math.max(0, Math.round(shellRect.top + pad - wrapRect.top))}px`;
      popup.style.bottom = 'auto';
    }
  }

  function positionPopupAfterLayout() {
    positionPopup();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => positionPopup());
    }
  }

  function setOpen(next) {
    open = !!next;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    popup.hidden = !open;
    trigger.classList.toggle('open', open);
    wrap.classList.toggle('open', open);
    shell.classList.toggle('suki-game-menu-open', open);
    if (open) {
      positionPopupAfterLayout();
    }
  }

  function onResize() {
    if (open) positionPopupAfterLayout();
  }

  function closeMenu() {
    setOpen(false);
  }

  function handleTriggerClick(event) {
    event.stopPropagation();
    setOpen(!open);
    if (open) {
      refresh();
      positionPopupAfterLayout();
    }
  }

  function onDocumentPointerDown(event) {
    if (!open) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (wrap.contains(target) || popup.contains(target)) return;
    closeMenu();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeMenu();
    }
  }

  function buildVolumeRow(item) {
    const volume = audioPrefs.musicVolume;
    const li = document.createElement('li');
    li.className = 'suki-game-menu-item suki-game-menu-volume suki-game-menu-item--setting';

    const label = document.createElement('span');
    label.className = 'suki-game-menu-label';
    label.textContent = item.label ?? 'Music volume';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'suki-game-menu-slider';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.setAttribute('aria-label', item.label ?? 'Music volume');

    function syncSlider() {
      slider.value = String(Math.round(volume.value * 100));
      slider.disabled = !audioPrefs.music.enabled;
    }

    slider.addEventListener('input', (event) => {
      event.stopPropagation();
      volume.setValue(Number(slider.value) / 100);
    });

    slider.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    audioPrefs.music.onChange(syncSlider);
    volume.onChange(syncSlider);
    syncSlider();

    li.append(label, slider);
    return li;
  }

  function buildToggleRow(item) {
    const prefKey = item.pref ?? 'music';
    const toggle = audioPrefs[prefKey];
    const li = document.createElement('li');
    li.className = 'suki-game-menu-item suki-game-menu-toggle suki-game-menu-item--setting';

    const label = document.createElement('span');
    label.className = 'suki-game-menu-label';
    label.textContent = item.label ?? prefKey;

    const switchBtn = document.createElement('button');
    switchBtn.type = 'button';
    switchBtn.className = 'suki-game-menu-switch';
    switchBtn.setAttribute('role', 'switch');
    switchBtn.dataset.pref = prefKey;

    function syncSwitch() {
      const on = toggle.enabled;
      switchBtn.setAttribute('aria-checked', on ? 'true' : 'false');
      switchBtn.classList.toggle('on', on);
      switchBtn.textContent = on ? 'On' : 'Off';
    }

    switchBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggle.setEnabled(!toggle.enabled);
      syncSwitch();
    });

    toggle.onChange(syncSwitch);
    syncSwitch();

    li.append(label, switchBtn);
    return li;
  }

  function buildModalRow(item) {
    const li = document.createElement('li');
    li.className = 'suki-game-menu-item suki-game-menu-item--link';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suki-game-menu-link';
    btn.textContent = item.label ?? item.id ?? 'Open';
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      closeMenu();
      if (item.id) modalHost.open(item.id);
    });
    li.appendChild(btn);
    return li;
  }

  function buildActionRow(item) {
    const li = document.createElement('li');
    li.className = 'suki-game-menu-item suki-game-menu-item--link';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suki-game-menu-link';
    btn.textContent = item.label ?? 'Action';
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      closeMenu();
      item.action?.();
    });
    li.appendChild(btn);
    return li;
  }

  function refresh() {
    list.innerHTML = '';
    const visible = filterVisibleMenuItems(items, game);

    for (const item of visible) {
      if (item.type === 'separator') {
        const sep = document.createElement('li');
        sep.className = 'suki-game-menu-sep';
        sep.setAttribute('aria-hidden', 'true');
        list.appendChild(sep);
        continue;
      }
      if (item.type === 'toggle') {
        list.appendChild(buildToggleRow(item));
        continue;
      }
      if (item.type === 'volume') {
        list.appendChild(buildVolumeRow(item));
        continue;
      }
      if (item.type === 'action') {
        list.appendChild(buildActionRow(item));
        continue;
      }
      if (item.type === 'modal') {
        list.appendChild(buildModalRow(item));
      }
    }

    if (open) positionPopupAfterLayout();
  }

  trigger.addEventListener('click', handleTriggerClick);
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);

  const api = {
    elements: {
      wrap,
      trigger,
      popup,
      list,
    },
    bind(handlers = {}) {
      game = handlers.game ?? null;
      refresh();
      return api;
    },
    setOpen,
    isOpen: () => open,
    refresh,
    close: closeMenu,
    destroy() {
      trigger.removeEventListener('click', handleTriggerClick);
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      wrap.remove();
      popup.remove();
      shell.classList.remove('suki-game-menu-open');
      setOpen(false);
    },
  };

  return api;
}
