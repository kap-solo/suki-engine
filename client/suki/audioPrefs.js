/**
 * Persisted music / SFX volume prefs for the game menu and audio engine.
 * Volume 0 = muted; burger menu mute icons restore the last non-zero level.
 */

/**
 * @param {object} options
 * @param {string} options.storageKey
 * @param {{ musicVolume?: number, sfxVolume?: number }} [options.defaults]
 */
export function createAudioPrefs(options) {
  const {
    storageKey,
    defaults = { musicVolume: 0.7, sfxVolume: 0.7 },
  } = options;

  /** @type {{ musicVolume: number, sfxVolume: number, musicMutedRestore: number, sfxMutedRestore: number }} */
  let state = {
    musicVolume: clampVolume(defaults.musicVolume ?? 0.7),
    sfxVolume: clampVolume(defaults.sfxVolume ?? 0.7),
    musicMutedRestore: clampVolume(defaults.musicVolume ?? 0.7),
    sfxMutedRestore: clampVolume(defaults.sfxVolume ?? 0.7),
  };

  /** @type {Map<string, Set<(value: boolean | number) => void>>} */
  const listeners = new Map([
    ['music', new Set()],
    ['sfx', new Set()],
    ['musicVolume', new Set()],
    ['sfxVolume', new Set()],
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

      if (typeof parsed.musicVolume === 'number') {
        state.musicVolume = clampVolume(parsed.musicVolume);
      } else if (parsed.music === false) {
        state.musicVolume = 0;
      }

      if (typeof parsed.sfxVolume === 'number') {
        state.sfxVolume = clampVolume(parsed.sfxVolume);
      } else if (parsed.sfx === false) {
        state.sfxVolume = 0;
      }

      if (typeof parsed.musicMutedRestore === 'number') {
        state.musicMutedRestore = clampVolume(parsed.musicMutedRestore);
      }
      if (typeof parsed.sfxMutedRestore === 'number') {
        state.sfxMutedRestore = clampVolume(parsed.sfxMutedRestore);
      }
    } catch {
      /* ignore corrupt prefs */
    }
  }

  function save() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          musicVolume: state.musicVolume,
          sfxVolume: state.sfxVolume,
          musicMutedRestore: state.musicMutedRestore,
          sfxMutedRestore: state.sfxMutedRestore,
        }),
      );
    } catch {
      /* quota / private mode */
    }
  }

  /**
   * @param {'music' | 'sfx' | 'musicVolume' | 'sfxVolume'} key
   */
  function notify(key) {
    const value =
      key === 'music'
        ? state.musicVolume > 0
        : key === 'sfx'
          ? state.sfxVolume > 0
          : state[key];
    for (const fn of listeners.get(key) ?? []) {
      fn(value);
    }
  }

  /**
   * @param {'musicVolume' | 'sfxVolume'} volumeKey
   * @param {'music' | 'sfx'} enabledKey
   */
  function createVolumePref(volumeKey, enabledKey) {
    const restoreKey = volumeKey === 'musicVolume' ? 'musicMutedRestore' : 'sfxMutedRestore';

    return {
      get value() {
        return state[volumeKey];
      },
      setValue(value) {
        const next = clampVolume(value);
        if (state[volumeKey] === next) return;
        if (next > 0) {
          state[restoreKey] = next;
        }
        state[volumeKey] = next;
        save();
        notify(volumeKey);
        notify(enabledKey);
      },
      /** @param {(volume: number) => void} fn */
      onChange(fn) {
        listeners.get(volumeKey)?.add(fn);
        return () => listeners.get(volumeKey)?.delete(fn);
      },
      toggleMute() {
        if (state[volumeKey] > 0) {
          state[restoreKey] = state[volumeKey];
          this.setValue(0);
          return;
        }
        this.setValue(state[restoreKey] > 0 ? state[restoreKey] : 0.7);
      },
      get isMuted() {
        return state[volumeKey] <= 0;
      },
    };
  }

  /**
   * @param {'music' | 'sfx'} key
   * @param {'musicVolume' | 'sfxVolume'} volumeKey
   */
  function createEnabledFacade(key, volumeKey) {
    const volume = volumeKey === 'musicVolume' ? musicVolume : sfxVolume;
    return {
      get enabled() {
        return state[volumeKey] > 0;
      },
      setEnabled(value) {
        if (value) {
          if (state[volumeKey] <= 0) {
            volume.setValue(state[volumeKey === 'musicVolume' ? 'musicMutedRestore' : 'sfxMutedRestore'] || 0.7);
          }
          return;
        }
        if (state[volumeKey] > 0) {
          state[volumeKey === 'musicVolume' ? 'musicMutedRestore' : 'sfxMutedRestore'] = state[volumeKey];
        }
        volume.setValue(0);
      },
      /** @param {(enabled: boolean) => void} fn */
      onChange(fn) {
        listeners.get(key)?.add(fn);
        return () => listeners.get(key)?.delete(fn);
      },
    };
  }

  const musicVolume = createVolumePref('musicVolume', 'music');
  const sfxVolume = createVolumePref('sfxVolume', 'sfx');

  load();

  return {
    music: createEnabledFacade('music', 'musicVolume'),
    sfx: createEnabledFacade('sfx', 'sfxVolume'),
    musicVolume,
    sfxVolume,
    getState() {
      return {
        music: state.musicVolume > 0,
        sfx: state.sfxVolume > 0,
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        musicMutedRestore: state.musicMutedRestore,
        sfxMutedRestore: state.sfxMutedRestore,
      };
    },
    reset() {
      state = {
        musicVolume: clampVolume(defaults.musicVolume ?? 0.7),
        sfxVolume: clampVolume(defaults.sfxVolume ?? 0.7),
        musicMutedRestore: clampVolume(defaults.musicVolume ?? 0.7),
        sfxMutedRestore: clampVolume(defaults.sfxVolume ?? 0.7),
      };
      save();
      notify('music');
      notify('sfx');
      notify('musicVolume');
      notify('sfxVolume');
    },
  };
}
