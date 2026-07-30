/**
 * Game audio — background music loop + one-shot SFX, driven by audioPrefs.
 */

import { getSfxBus } from './sfxBus.js';

/**
 * @typedef {object} GameAudioAssets
 * @property {string} [music] — looping background track URL
 * @property {Record<string, string>} [sfx] — named effect URLs (e.g. play, win)
 */

/**
 * @param {object} options
 * @param {ReturnType<import('./audioPrefs.js').createAudioPrefs>} options.audioPrefs
 * @param {GameAudioAssets} [options.assets]
 * @param {boolean} [options.autoUnlock=true] — first document tap; set false when using preloader
 */
export function createGameAudio(options) {
  const { audioPrefs, assets: initialAssets = {}, autoUnlock = true } = options;

  if (typeof document === 'undefined' || !audioPrefs) {
    return {
      setAssets() {},
      playSfx() {},
      syncMusic() {},
      unlock() {},
      destroy() {},
    };
  }

  /** @type {GameAudioAssets} */
  let assets = { music: initialAssets.music, sfx: { ...initialAssets.sfx } };

  /** @type {HTMLAudioElement | null} */
  let musicEl = null;
  let unlocked = false;
  /** @type {(() => void) | null} */
  let unlockHandler = null;
  const sfxBus = getSfxBus(audioPrefs);

  function effectiveMusicVolume() {
    return audioPrefs.musicVolume.value;
  }

  function ensureMusicElement() {
    if (!assets.music) return null;
    if (!musicEl) {
      musicEl = new Audio(assets.music);
      musicEl.loop = true;
      musicEl.preload = 'auto';
    }
    return musicEl;
  }

  function syncMusic() {
    const el = ensureMusicElement();
    if (!el) return;

    el.volume = Math.min(1, Math.max(0, effectiveMusicVolume()));

    if (!unlocked || audioPrefs.musicVolume.value <= 0) {
      el.pause();
      return;
    }

    if (el.paused) {
      el.play().catch(() => {});
    }
  }

  function primeSfx() {
    const urls = Object.values(assets.sfx ?? {}).filter(Boolean);
    if (urls.length) sfxBus.primeUrls(urls);
  }

  function unlock() {
    sfxBus.resumeContextSync();
    if (unlocked) return;
    unlocked = true;
    if (unlockHandler) {
      document.removeEventListener('pointerdown', unlockHandler);
      unlockHandler = null;
    }
    primeSfx();
    syncMusic();
  }

  function bindUnlock() {
    if (unlocked || unlockHandler) return;
    unlockHandler = () => unlock();
    document.addEventListener('pointerdown', unlockHandler);
  }

  function playSfx(name) {
    if (audioPrefs.sfxVolume.value <= 0) return;
    const url = assets.sfx?.[name];
    if (!url) return;
    if (!unlocked) {
      unlock();
    }
    sfxBus.playOneShot(url);
  }

  function setAssets(next) {
    assets = {
      music: next.music ?? assets.music,
      sfx: { ...assets.sfx, ...next.sfx },
    };
    if (musicEl && assets.music && musicEl.src !== new URL(assets.music, window.location.href).href) {
      musicEl.pause();
      musicEl = null;
    }
    if (unlocked) {
      primeSfx();
    }
    syncMusic();
  }

  audioPrefs.music.onChange(syncMusic);
  audioPrefs.musicVolume.onChange(syncMusic);
  audioPrefs.sfxVolume.onChange(() => {});

  if (autoUnlock) {
    bindUnlock();
  }
  syncMusic();

  return {
    setAssets,
    playSfx,
    syncMusic,
    unlock,
    isUnlocked: () => unlocked,
    destroy() {
      if (unlockHandler) {
        document.removeEventListener('pointerdown', unlockHandler);
        unlockHandler = null;
      }
      if (musicEl) {
        musicEl.pause();
        musicEl.src = '';
        musicEl = null;
      }
    },
  };
}
