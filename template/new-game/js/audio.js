/**
 * Game audio assets — replace URLs with your own music and SFX files.
 *
 * Drop files in `assets/audio/` (MP3 or OGG). The server serves them at `/assets/audio/…`.
 *
 * Burger menu audio: Music + Sound effects rows (label, mute icon, volume slider).
 * Volumes persist via `createAudioPrefs` — use `audioPrefs.musicVolume` / `audioPrefs.sfxVolume`
 * (0–1). `gameAudio.playSfx()` respects SFX volume automatically.
 */

import { getSfxBus, resumeGameSfxContext } from '@kap-solo/suki-engine/client/rgs.js';

export const GAME_AUDIO_ASSETS = {
  music: 'assets/audio/music.mp3',
  sfx: {
    play: 'assets/audio/play.mp3',
    win: 'assets/audio/win.mp3',
    lose: 'assets/audio/lose.mp3',
  },
};

/** Paths to front-load during the Suki preloader (missing files are skipped with a warning). */
export function buildPreloadAssets() {
  const assets = [];
  if (GAME_AUDIO_ASSETS.music) {
    assets.push({ src: GAME_AUDIO_ASSETS.music, type: 'audio' });
  }
  for (const src of Object.values(GAME_AUDIO_ASSETS.sfx ?? {})) {
    if (src) assets.push({ src, type: 'audio' });
  }
  return assets;
}

/**
 * @param {ReturnType<import('@kap-solo/suki-engine/client/rgs.js').createGameAudio>} gameAudio
 */
export function wireTemplateAudio(gameAudio) {
  gameAudio.setAssets(GAME_AUDIO_ASSETS);
}

/**
 * Warm SFX decode after the preloader tap — Web Audio buffers (iOS-safe).
 * @param {ReturnType<import('@kap-solo/suki-engine/client/rgs.js').createAudioPrefs>} audioPrefs
 */
export function primeTemplateAudio(audioPrefs) {
  resumeGameSfxContext(audioPrefs);
  const urls = Object.values(GAME_AUDIO_ASSETS.sfx ?? {}).filter(Boolean);
  if (!urls.length || audioPrefs.sfxVolume.value <= 0) return;
  getSfxBus(audioPrefs).primeUrls(urls);
}
