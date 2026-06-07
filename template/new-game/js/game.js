import { initSuki } from '@kap-solo/suki-engine/client/suki/config.js';
import { bootstrapPlayMode } from '@kap-solo/suki-engine/client/suki/bootstrap.js';
import { createJurisdictionController } from '@kap-solo/suki-engine/client/suki/jurisdiction.js';
import { createSukiLifecycle } from '@kap-solo/suki-engine/client/suki/lifecycle.js';

initSuki({
  gameId: 'my-game',
  replayVersion: '1',
  sessionStorageKey: 'myGame.rgsSessionID',
});

const jurisdiction = createJurisdictionController();

const lifecycle = createSukiLifecycle({
  jurisdiction,
  handlers: {
    // Register one handler per event.type in your math books
    myGameEvent: async (_event, _ctx) => {},
    setTotalWin: async () => {},
    finalWin: async () => {},
  },
  onStaticRound: () => {},
  applyBalance: () => {},
  onRoundSettled: () => {},
  setMessage: (text) => {
    document.getElementById('message').textContent = text;
  },
  getBetApi: () => 1_000_000,
  setBetFromApi: () => {},
  buildSettledResult: (round) => ({
    payoutApi: round.payout,
    profitApi: round.payout - round.amount,
  }),
});

bootstrapPlayMode({
  applyAuthConfig: () => {},
  lifecycle,
  setMessage: (text) => {
    document.getElementById('message').textContent = text;
  },
  setRgsReady: () => {},
  onReady: () => {},
});
