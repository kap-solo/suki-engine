/**
 * Web Audio one-shot SFX bus — reliable on iOS / Stake iframes.
 * HTMLAudioElement SFX stay blocked even after gesture unlock; decoded buffers do not.
 */

/**
 * @param {ReturnType<import('./audioPrefs.js').createAudioPrefs>} audioPrefs
 */
export function createSfxBus(audioPrefs) {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {GainNode | null} */
  let masterGain = null;
  /** @type {Map<string, AudioBuffer>} */
  const bufferCache = new Map();
  /** @type {Map<string, Promise<AudioBuffer | null>>} */
  const loadPromises = new Map();
  /** @type {Map<string, { source: AudioBufferSourceNode, gain: GainNode }>} */
  const activeBeds = new Map();

  function sfxLevel() {
    return audioPrefs.sfxVolume?.value ?? (audioPrefs.sfx?.enabled ? 1 : 0);
  }

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = sfxLevel();
    masterGain.connect(ctx.destination);
    return ctx;
  }

  /** Must run synchronously inside a user-gesture handler (iOS Web Audio policy). */
  function resumeContextSync() {
    ensureContext();
    if (ctx?.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  }

  function applyMasterVolume() {
    if (!masterGain) return;
    masterGain.gain.value = Math.min(1, Math.max(0, sfxLevel()));
  }

  audioPrefs.sfxVolume?.onChange(applyMasterVolume);

  /** @param {string} url */
  function loadBuffer(url) {
    const cached = bufferCache.get(url);
    if (cached) return Promise.resolve(cached);
    const pending = loadPromises.get(url);
    if (pending) return pending;

    const promise = (async () => {
      ensureContext();
      if (!ctx || !url) return null;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);
      bufferCache.set(url, buffer);
      return buffer;
    })().catch(() => null);

    loadPromises.set(url, promise);
    return promise;
  }

  /** @param {string[]} urls */
  function primeUrls(urls) {
    resumeContextSync();
    for (const url of urls) {
      if (url) void loadBuffer(url);
    }
  }

  /** @param {string} url @param {() => void} [unlock] */
  function playOneShot(url, unlock) {
    unlock?.();
    resumeContextSync();
    applyMasterVolume();
    if (sfxLevel() <= 0 || !url) return;

    void (async () => {
      const buffer = await loadBuffer(url);
      if (!buffer || !ctx || !masterGain) return;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(masterGain);
      source.onended = () => {
        source.disconnect();
      };
      source.start(0);
    })();
  }

  /** @param {string} url @param {string} key @param {() => void} [unlock] */
  function startBed(url, key, unlock) {
    unlock?.();
    resumeContextSync();
    applyMasterVolume();
    if (sfxLevel() <= 0 || !url) return;

    stopBed(key, { fadeMs: 0 });

    void (async () => {
      const buffer = await loadBuffer(url);
      if (!buffer || !ctx || !masterGain) return;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(masterGain);
      source.onended = () => {
        activeBeds.delete(key);
        source.disconnect();
        gain.disconnect();
      };
      source.start(0);
      activeBeds.set(key, { source, gain });
    })();
  }

  /** @param {string} key @param {{ fadeMs?: number }} [opts] */
  function stopBed(key, { fadeMs = 0 } = {}) {
    const active = activeBeds.get(key);
    if (!active) return;
    const { source, gain } = active;
    activeBeds.delete(key);

    if (!ctx || fadeMs <= 0) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      gain.disconnect();
      return;
    }

    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
    window.setTimeout(() => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      gain.disconnect();
    }, fadeMs + 30);
  }

  /** @param {string} url @param {number} fallbackMs */
  function durationMs(url, fallbackMs) {
    const buffer = bufferCache.get(url);
    if (buffer) return Math.round(buffer.duration * 1000);
    void loadBuffer(url);
    return fallbackMs;
  }

  return {
    resumeContextSync,
    primeUrls,
    playOneShot,
    startBed,
    stopBed,
    durationMs,
    loadBuffer,
  };
}

/** @type {WeakMap<ReturnType<import('./audioPrefs.js').createAudioPrefs>, ReturnType<createSfxBus>>} */
const sfxBusByPrefs = new WeakMap();

/** @param {ReturnType<import('./audioPrefs.js').createAudioPrefs>} audioPrefs */
export function getSfxBus(audioPrefs) {
  let bus = sfxBusByPrefs.get(audioPrefs);
  if (!bus) {
    bus = createSfxBus(audioPrefs);
    sfxBusByPrefs.set(audioPrefs, bus);
  }
  return bus;
}

/** Resume the SFX AudioContext during a user gesture (iOS). */
export function resumeGameSfxContext(audioPrefs) {
  getSfxBus(audioPrefs).resumeContextSync();
}
