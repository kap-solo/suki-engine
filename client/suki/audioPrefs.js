/**
 * Persisted music / SFX toggles for the game menu.
 */

/**
 * @param {object} options
 * @param {string} options.storageKey
 * @param {{ music?: boolean, sfx?: boolean }} [options.defaults]
 */
export function createAudioPrefs(options) {
  const { storageKey, defaults = { music: true, sfx: true } } = options;

  /** @type {{ music: boolean, sfx: boolean }} */
  let state = {
    music: defaults.music ?? true,
    sfx: defaults.sfx ?? true,
  };

  /** @type {Map<'music' | 'sfx', Set<(enabled: boolean) => void>>} */
  const listeners = new Map([
    ['music', new Set()],
    ['sfx', new Set()],
  ]);

  function load() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.music === 'boolean') state.music = parsed.music;
      if (typeof parsed.sfx === 'boolean') state.sfx = parsed.sfx;
    } catch {
      /* ignore corrupt prefs */
    }
  }

  function save() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* quota / private mode */
    }
  }

  function notify(key) {
    const enabled = state[key];
    for (const fn of listeners.get(key) ?? []) {
      fn(enabled);
    }
  }

  /**
   * @param {'music' | 'sfx'} key
   */
  function createToggle(key) {
    return {
      get enabled() {
        return state[key];
      },
      setEnabled(value) {
        const next = !!value;
        if (state[key] === next) return;
        state[key] = next;
        save();
        notify(key);
      },
      /** @param {(enabled: boolean) => void} fn */
      onChange(fn) {
        listeners.get(key)?.add(fn);
        return () => listeners.get(key)?.delete(fn);
      },
    };
  }

  load();

  return {
    music: createToggle('music'),
    sfx: createToggle('sfx'),
    getState() {
      return { ...state };
    },
    reset() {
      state = {
        music: defaults.music ?? true,
        sfx: defaults.sfx ?? true,
      };
      save();
      notify('music');
      notify('sfx');
    },
  };
}
