/** Rename these when starting a new title. */
export const GAME = {
  id: 'my-game',
  title: 'My Game',
  subtitle: 'Suki Engine starter — one play, one result',
  replayVersion: '1',
  targetRtpPercent: 100,
};

export const DEFAULT_BET = 1;
export const BET_OPTIONS = [0.5, 1, 2, 5, 10];

/** Keep in sync with data/index.json — drives game.betModes + mock RGS betModes. */
export const GAME_MODES = [
  { name: 'base', cost: 1 },
  { name: 'bonus', cost: 100 },
];
