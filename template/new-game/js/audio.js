/**
 * Game audio assets — replace URLs with your own music and SFX files.
 *
 * Drop files in `assets/audio/` (MP3 or OGG). The server serves them at `/assets/audio/…`.
 */

export const GAME_AUDIO_ASSETS = {
  music: 'assets/audio/music.mp3',
  sfx: {
    play: 'assets/audio/play.mp3',
    win: 'assets/audio/win.mp3',
    lose: 'assets/audio/lose.mp3',
  },
};

/**
 * @param {ReturnType<import('@kap-solo/suki-engine/client/rgs.js').createGameAudio>} gameAudio
 */
export function wireTemplateAudio(gameAudio) {
  gameAudio.setAssets(GAME_AUDIO_ASSETS);
}
