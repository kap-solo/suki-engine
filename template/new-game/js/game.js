import { createGameBootstrap } from '@kap-solo/suki-engine/client/rgs.js';

const messageEl = document.getElementById('message');
const autoplayBtn = document.getElementById('autoplay-btn');

function setMessage(text) {
  messageEl.textContent = text;
}

const game = createGameBootstrap({
  suki: {
    gameId: 'my-game',
    replayVersion: '1',
    sessionStorageKey: 'myGame.rgsSessionID',
  },
  shell: {
    elements: {
      complianceDev: document.getElementById('compliance-dev'),
      testControls: document.querySelector('[data-suki-dev]'),
      autoplay: autoplayBtn,
      // sessionTimer: document.getElementById('session-timer'),
      // sessionTimerContainer: document.getElementById('session-timer-stat'),
      // balanceLabel: document.getElementById('balance-label'),
      // betLabel: document.getElementById('bet-label'),
      // dropButton: document.getElementById('drop-btn'),
    },
  },
  lifecycle: {
    handlers: {
      // Register one handler per event.type in your math books
      myGameEvent: async (_event, _ctx) => {},
      setTotalWin: async () => {},
      finalWin: async () => {},
    },
    onStaticRound: () => {},
    applyBalance: () => {},
    onRoundSettled: () => {},
    setMessage,
    getBetApi: () => 1_000_000,
    setBetFromApi: () => {},
    buildSettledResult: (round) => ({
      payoutApi: round.payout,
      profitApi: round.payout - round.amount,
    }),
  },
  auth: {
    onConfigured(auth, _data) {
      game.controls.setVisible(autoplayBtn, game.controls.canAutoplay);
      // Apply auth.balanceDisplay, auth.betLevelsDisplay to your HUD
      void auth;
    },
  },
  ui: {
    setMessage,
    onReady: () => setMessage(game.t('setBetPrompt')),
  },
});

game.syncDevTools();
game.start();
