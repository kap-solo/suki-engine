/**
 * Persisted music / SFX prefs for the game menu and audio engine.
 */

/**
 * @param {object} options
 * @param {string} options.storageKey
 * @param {{ music?: boolean, sfx?: boolean, musicVolume?: number }} [options.defaults]
 */
export function createAudioPrefs(options) {
  const {
    storageKey,
    defaults = { music: true, sfx: true, musicVolume: 0.7 },
  } = options;

  /** @type {{ music: boolean, sfx: boolean, musicVolume: number }} */
  let state = {
    music: defaults.music ?? true,
    sfx: defaults.sfx ?? true,
    musicVolume: clampVolume(defaults.musicVolume ?? 0.7),
  };

  /** @type {Map<string, Set<(value: boolean | number) => void>>} */
  const listeners = new Map([
    ['music', new Set()],
    ['sfx', new Set()],
    ['musicVolume', new Set()],
  ]);

  function clampVolume(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0.7;
    return Math.min(1, Math.max(0, n));
  }

  function load() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.music === 'boolean') state.music = parsed.music;
      if (typeof parsed.sfx === 'boolean') state.sfx = parsed.sfx;
      if (typeof parsed.musicVolume === 'number') state.musicVolume = clampVolume(parsed.musicVolume);
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

  /**
   * @param {'music' | 'sfx' | 'musicVolume'} key
   */
  function notify(key) {
    const value = state[key];
    for (const fn of listeners.get(key) ?? []) {
      fn(value);
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

  const musicVolume = {
    get value() {
      return state.musicVolume;
    },
    setValue(value) {
      const next = clampVolume(value);
      if (state.musicVolume === next) return;
      state.musicVolume = next;
      save();
      notify('musicVolume');
    },
    /** @param {(volume: number) => void} fn */
    onChange(fn) {
      listeners.get('musicVolume')?.add(fn);
      return () => listeners.get('musicVolume')?.delete(fn);
    },
  };

  load();

  return {
    music: createToggle('music'),
    sfx: createToggle('sfx'),
    musicVolume,
    getState() {
      return { ...state };
    },
    reset() {
      state = {
        music: defaults.music ?? true,
        sfx: defaults.sfx ?? true,
        musicVolume: clampVolume(defaults.musicVolume ?? 0.7),
      };
      save();
      notify('music');
      notify('sfx');
      notify('musicVolume');
    },
  };
}
