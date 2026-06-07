import { initSuki } from '@kap-solo/suki-engine/client/suki/config.js';
import { bootstrapPlayMode } from '@kap-solo/suki-engine/client/suki/bootstrap.js';
import { createJurisdictionController } from '@kap-solo/suki-engine/client/suki/jurisdiction.js';
import { createSukiLifecycle } from '@kap-solo/suki-engine/client/suki/lifecycle.js';
import { parseAuthResponse, createControlPolicy, applyProductionShell } from '@kap-solo/suki-engine/client/rgs.js';

initSuki({
  gameId: 'my-game',
  replayVersion: '1',
  sessionStorageKey: 'myGame.rgsSessionID',
});

applyProductionShell({
  elements: {
    complianceDev: document.getElementById('compliance-dev'),
    testControls: document.querySelector('[data-suki-dev]'),
  },
});

const jurisdiction = createJurisdictionController();
const controls = createControlPolicy(jurisdiction);

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
  applyAuthConfig: (data) => {
    const auth = parseAuthResponse(data);
    jurisdiction.mergeFromServer(auth.jurisdiction);
    controls.setVisible(document.getElementById('autoplay-btn'), controls.canAutoplay);
  },
  lifecycle,
  setMessage: (text) => {
    document.getElementById('message').textContent = text;
  },
  setRgsReady: () => {},
  onReady: () => {},
});
