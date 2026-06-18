/**
 * My Game — Suki Engine starter template.
 * Replace handlers, math books, and presentation — keep the RGS lifecycle.
 */

import { apiToDisplay, displayToApi } from '@kap-solo/suki-engine/client/money.js';
import {
  authenticate,
  buildReplayUrl,
  classifyRgsError,
  createAudioPrefs,
  createBetUi,
  createGameAudio,
  createGameBootstrap,
  createGameMenu,
  createGamePreloader,
  createModalHost,
  createRecentResultsStore,
  getReplayParams,
  getSessionID,
  isReplayMode,
  messageForRgsCode,
  requestReplay,
  startNewRgsSession,
} from '@kap-solo/suki-engine/client/rgs.js';
import { buildPreloadAssets } from './audio.js';
import { BET_OPTIONS, DEFAULT_BET, GAME, GAME_MODES } from './config.js';
import { registerGameModals } from './menu.js';
import { buildGameSettledResult, parseGameReveal } from './round.js';

const shellEl = document.querySelector('.suki-stake-shell');
const brandEl = document.querySelector('.suki-brand');
const modalHost = createModalHost({ root: shellEl });
const audioPrefs = createAudioPrefs({ storageKey: `${GAME.id}.audio` });
const gameAudio = createGameAudio({ audioPrefs, autoUnlock: false });
wireTemplateAudio(gameAudio);
const recentResults = createRecentResultsStore({ max: 25 });
const gameMenu = createGameMenu({
  brand: brandEl,
  shell: shellEl,
  modalHost,
  audioPrefs,
});

const balanceEl = document.getElementById('balance');
const betEl = document.getElementById('bet-display');
const resultEl = document.getElementById('last-result');
const messageEl = document.getElementById('message');
const replayBanner = document.getElementById('replay-banner');
const balanceHud = document.getElementById('balance-hud');
const statsEl = document.getElementById('stats');
const complianceDevEl = document.getElementById('compliance-dev');
const sessionTimerStat = document.getElementById('session-timer-stat');
const sessionTimerEl = document.getElementById('session-timer');
const outcomeCard = document.getElementById('outcome-card');
const outcomeSymbol = document.getElementById('outcome-symbol');
const outcomeMult = document.getElementById('outcome-mult');
const balanceLabelEl = document.getElementById('balance-label');
const betLabelEl = document.getElementById('bet-label');
const lastResultLabelEl = document.getElementById('last-result-label');
const replayNoteEl = document.getElementById('replay-note');
const principlesAside = document.querySelector('.principles');

document.getElementById('game-title').textContent = GAME.title;
document.getElementById('game-subtitle').textContent = GAME.subtitle;

const betUi = createBetUi({
  root: document.getElementById('bet-ui-root'),
  showModeRow: true,
});

let balance = 0;
let bet = DEFAULT_BET;
/** @type {number[]} */
let betOptions = [...BET_OPTIONS];
let playing = false;
let autoplaying = false;
let animationSpeed = 1;
const replayMode = isReplayMode();
/** @type {object | null} */
let replayRound = null;
let lastReplayUrl = '';

function setMessage(text) {
  messageEl.textContent = text;
}

function fmt(amount) {
  return game.formatCurrency(amount);
}

function copyTerm(key, vars) {
  return game.copy.t(key, vars);
}

function formatMult(mult) {
  if (mult >= 100) return `${mult.toFixed(0)}×`;
  if (mult >= 10) return `${mult.toFixed(1)}×`;
  return `${mult.toFixed(2)}×`;
}

function showOutcome(reveal, { animate = true } = {}) {
  outcomeSymbol.textContent = reveal.symbol ?? '?';
  outcomeMult.textContent = formatMult(reveal.multiplier ?? 0);
  outcomeCard.classList.remove('reveal');
  if (animate) {
    void outcomeCard.offsetWidth;
    outcomeCard.classList.add('reveal');
  }
}

async function animateReveal(event) {
  outcomeCard.classList.remove('reveal');
  await sleep(Math.max(120, Math.round(400 / animationSpeed)));
  showOutcome(event, { animate: true });
}

function playCostDisplay() {
  const baseApi = displayToApi(bet);
  const playApi = game.betModes.playAmountApi(baseApi);
  return apiToDisplay(playApi);
}

function playButtonLabel() {
  if (game.betModes.isBuyMode()) return 'Buy & play';
  return copyTerm('drop');
}

function syncHud() {
  balanceEl.textContent = replayMode ? '—' : fmt(balance);
  betEl.textContent = fmt(bet);
  const rtpPart = game.controls.showRtp ? ` · target RTP ${GAME.targetRtpPercent}%` : '';
  const modePart = game.betModes.modes.length > 1 ? ' · base + buy bonus' : '';
  statsEl.textContent = `Starter math · 3 outcomes · Stake-shaped lifecycle${modePart}${rtpPart}`;
  betUi.syncModeCostHint();
}

function displayRoundResult({ symbol, multiplier, payout, profit }) {
  resultEl.textContent = `${symbol} ${formatMult(multiplier)} → ${fmt(payout)}`;
  if (profit > 0) {
    setMessage(`${copyTerm('won')} ${fmt(profit)}.`);
  } else if (payout === bet) {
    setMessage(`${symbol} — ${copyTerm('stakeReturned')}.`);
  } else {
    setMessage(`${symbol} — ${formatMult(multiplier)} return.`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function syncControls() {
  betUi.sync();
}

async function withPlayLock(fn) {
  playing = true;
  animationSpeed = 1;
  syncControls();
  try {
    return await fn();
  } finally {
    playing = false;
    animationSpeed = 1;
    syncControls();
  }
}

const game = createGameBootstrap({
  suki: {
    gameId: GAME.id,
    replayVersion: GAME.replayVersion,
    sessionStorageKey: 'myGame.rgsSessionID',
  },
  shell: {
    elements: {
      complianceDev: complianceDevEl,
      testControls: betUi.elements.testControls,
      copyReplay: betUi.elements.copyReplay,
      autoplay: betUi.elements.autoplay,
      newSession: betUi.elements.newSession,
      devAside: principlesAside,
      sessionTimer: sessionTimerEl,
      sessionTimerContainer: sessionTimerStat,
      balanceLabel: balanceLabelEl,
      betLabel: betLabelEl,
      lastResultLabel: lastResultLabelEl,
      replayNote: replayNoteEl,
      dropButton: betUi.elements.dropButton,
    },
    screenPreview: { root: shellEl },
  },
  lifecycle: {
    handlers: {
      gameReveal: async (event, { animate }) => {
        if (animate) {
          await animateReveal(event);
        } else {
          showOutcome(event, { animate: false });
        }
      },
      setTotalWin: async () => {},
      finalWin: async () => {},
    },
    onResumeStatic: (round) => {
      showOutcome(parseGameReveal(round), { animate: false });
    },
    onStaticRound: (round) => {
      showOutcome(parseGameReveal(round), { animate: false });
    },
    applyBalance: (balanceObj) => {
      balance = apiToDisplay(balanceObj.amount);
    },
    buildSettledResult: buildGameSettledResult,
    playingMessage: 'Playing…',
    onRoundSettled: (round, result) => {
      const payout = apiToDisplay(result.payoutApi);
      const debitDisplay = apiToDisplay(round.amount);
      syncHud();

      const replayEvent = result.replayEvent || `${getSessionID()}-${round.roundID}`;
      lastReplayUrl = buildReplayUrl({
        event: replayEvent,
        amountApi: round.amount,
        mode: game.betModes.replayModeKey(),
      });
      betUi.setLastReplayUrl(lastReplayUrl);
      syncControls();

      recentResults.push({
        data: {
          symbol: result.symbol,
          multiplier: result.multiplier,
          payout,
        },
      });

      displayRoundResult({
        symbol: result.symbol,
        multiplier: result.multiplier,
        payout,
        profit: payout - debitDisplay,
      });

      if (payout > debitDisplay) {
        gameAudio.playSfx('win');
      } else if (payout < debitDisplay) {
        gameAudio.playSfx('lose');
      }
    },
    setMessage,
    getBetApi: () => displayToApi(bet),
    setBetFromApi: (amountApi) => {
      bet = apiToDisplay(amountApi);
    },
  },
  auth: {
    defaultBetDisplay: DEFAULT_BET,
    gameModes: GAME_MODES,
    onConfigured(auth) {
      if (auth.balanceDisplay != null) {
        balance = auth.balanceDisplay;
      }
      if (auth.betLevelsDisplay.length) {
        betUi.setBetLevels(auth.betLevelsDisplay, auth.defaultBetDisplay ?? betOptions[0]);
        betOptions = auth.betLevelsDisplay;
        bet = auth.defaultBetDisplay ?? betOptions[0];
      }
      betUi.renderModes();
    },
  },
  ui: {
    setMessage,
    syncHud,
    isBusy: () => playing || autoplaying,
    onRgsReady: () => syncControls(),
    onReady: () => {
      syncHud();
      setMessage(copyTerm('setBetPrompt'));
    },
    onAuthRound: handleAuthRoundOutcome,
  },
  onJurisdictionChange: () => {
    gameMenu.refresh();
    betUi.renderModes();
    syncControls();
    syncHud();
  },
  replay: { start: bootstrapReplay },
});

const { controls, lifecycle, applyAuthConfig, syncDevTools } = game;

gameMenu.bind({ game });
registerGameModals({
  modalHost,
  recentResults,
  game,
  formatCurrency: (amount) => game.formatCurrency(amount),
});

betUi.bind({
  game,
  replayMode,
  getBet: () => bet,
  setBet: (value) => {
    bet = value;
  },
  getBetOptions: () => betOptions,
  setBetOptions: (levels) => {
    betOptions = levels;
  },
  getBusy: () => playing || autoplaying,
  getPlaying: () => playing,
  getAutoplaying: () => autoplaying,
  getPlayLabel: playButtonLabel,
  getPlayCost: playCostDisplay,
  getBalance: () => balance,
  onBetChange: () => {
    syncHud();
    syncControls();
  },
  onModeChange: () => {
    syncHud();
    syncControls();
  },
  onDismissOverlays: () => {
    gameMenu.close();
    modalHost.close();
  },
  modalHost,
  getCopyTerm: copyTerm,
  formatCurrency: (amount) => game.formatCurrency(amount),
  onPlay: onPlay,
  onTurbo: () => {
    animationSpeed = 3;
  },
  onAutoplay: runAutoplay,
  onNewSession: onNewSession,
  onCopyReplay: onCopyReplayLink,
  onReplayAgain: () => {
    if (replayRound) playReplayAnimation(replayRound);
  },
});

async function onPlay() {
  if (playing || autoplaying) return;
  if (!game.rgsReady) {
    setMessage(copyTerm('connectingRgs'));
    return;
  }
  const playCost = playCostDisplay();
  if (balance < playCost) {
    setMessage(copyTerm('insufficientBalance'));
    return;
  }

  await withPlayLock(async () => {
    try {
      gameAudio.playSfx('play');
      await lifecycle.executeDrop({ animate: true });
    } catch (err) {
      console.error(err);
      const policy = classifyRgsError(String(err.message));
      if (policy.shouldResumeRound) {
        try {
          const data = await authenticate();
          applyAuthConfig(data);
          if (data.round?.active && data.round.state?.length) {
            await lifecycle.resumeRound(data.round, { meta: data.meta });
            return;
          }
        } catch (resumeErr) {
          console.error(resumeErr);
        }
      }
      setMessage(policy.message);
    }
  });
}

async function runAutoplay(roundCount) {
  if (playing || autoplaying || !controls.canAutoplay) return;
  if (!game.rgsReady || balance < playCostDisplay()) return;

  autoplaying = true;
  syncControls();
  let count = 0;
  try {
    for (let i = 0; i < roundCount; i += 1) {
      if (balance < playCostDisplay()) {
        setMessage(`${copyTerm('autoplayStopped')} ${count} plays.`);
        break;
      }
      setMessage(copyTerm('autoplayProgress', { current: i + 1, total: roundCount }));
      await lifecycle.executeDrop({ animate: false });
      count += 1;
    }
    if (count === roundCount) {
      setMessage(copyTerm('autoplayComplete', { count: roundCount }));
    }
  } catch (err) {
    console.error(err);
    setMessage(messageForRgsCode(String(err.message)));
  } finally {
    autoplaying = false;
    syncControls();
  }
}

function setPlayModeUi() {
  replayBanner.hidden = true;
  betUi.setView('play');
  balanceHud.hidden = false;
}

function setReplayModeUi() {
  replayBanner.hidden = false;
  betUi.setView('replay');
  balanceHud.hidden = true;
  betUi.setLastReplayUrl('');
}

async function playReplayAnimation(round) {
  playing = true;
  syncControls();
  try {
    const reveal = parseGameReveal(round);
    showOutcome(reveal, { animate: true });
    const payout = apiToDisplay(round.payout);
    const betDisplay = apiToDisplay(round.amount);
    displayRoundResult({
      symbol: reveal.symbol,
      multiplier: round.payoutMultiplier ?? reveal.multiplier ?? 0,
      payout,
      profit: payout - betDisplay,
    });
    setMessage('Replay complete.');
  } finally {
    playing = false;
    syncControls();
  }
}

async function bootstrapReplay() {
  setReplayModeUi();
  const params = getReplayParams();
  if (!params.event) {
    setMessage('Replay URL missing event parameter.');
    return;
  }
  setMessage('Loading replay…');
  try {
    const data = await requestReplay({
      game: params.game,
      version: params.version,
      mode: params.mode,
      event: params.event,
      amountApi: params.amountApi,
    });
    replayRound = data.round;
    game.setRgsReady(true);
    syncControls();
    syncHud();
    await playReplayAnimation(replayRound);
  } catch (err) {
    console.error(err);
    setMessage(messageForRgsCode(String(err.message)));
  }
}

function handleAuthRoundOutcome(authOutcome) {
  if (authOutcome.status === 'resumed') {
    setMessage('Round resumed.');
  } else if (authOutcome.status === 'completed' && authOutcome.result) {
    const result = authOutcome.result;
    displayRoundResult({
      symbol: result.symbol,
      multiplier: result.multiplier,
      payout: apiToDisplay(result.payoutApi),
      profit: apiToDisplay(result.profitApi),
    });
    setMessage('Last completed round restored.');
  }
}

async function onNewSession() {
  startNewRgsSession();
  lastReplayUrl = '';
  betUi.setLastReplayUrl('');
  setMessage('New session — reconnecting…');
  game.start();
}

async function onCopyReplayLink() {
  if (!lastReplayUrl) return;
  try {
    await navigator.clipboard.writeText(lastReplayUrl);
    setMessage('Replay link copied.');
  } catch {
    setMessage(lastReplayUrl);
  }
}

betUi.renderBetLevels();
syncHud();
syncDevTools();
syncControls();

if (replayMode) {
  setReplayModeUi();
  game.start();
} else {
  setPlayModeUi();
  createGamePreloader({
    shell: shellEl,
    brand: 'SUKI engine',
    subtitle: GAME.title,
    hint: 'Tap anywhere to play',
    connectingHint: copyTerm('connectingRgs'),
    assets: buildPreloadAssets(),
    gate: () => game.checkRgsGate(),
    bootstrap: () => game.start(),
    onContinue: () => {
      gameAudio.unlock();
    },
  });
}
