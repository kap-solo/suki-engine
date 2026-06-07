/**
 * My Game — Suki Engine starter template.
 * Replace handlers, math books, and presentation — keep the RGS lifecycle.
 */

import { apiToDisplay, displayToApi } from '@kap-solo/suki-engine/client/money.js';
import {
  authenticate,
  buildReplayUrl,
  classifyRgsError,
  createGameBootstrap,
  getReplayParams,
  getSessionID,
  isReplayMode,
  messageForRgsCode,
  requestReplay,
  startNewRgsSession,
} from '@kap-solo/suki-engine/client/rgs.js';
import { BET_OPTIONS, DEFAULT_BET, GAME, GAME_MODES } from './config.js';
import { buildGameSettledResult, parseGameReveal } from './round.js';

const balanceEl = document.getElementById('balance');
const betEl = document.getElementById('bet-display');
const resultEl = document.getElementById('last-result');
const messageEl = document.getElementById('message');
const playBtn = document.getElementById('play-btn');
const autoplayBtn = document.getElementById('autoplay-btn');
const newSessionBtn = document.getElementById('new-session-btn');
const copyReplayBtn = document.getElementById('copy-replay-btn');
const replayBanner = document.getElementById('replay-banner');
const playControls = document.getElementById('play-controls');
const replayControls = document.getElementById('replay-controls');
const replayAgainBtn = document.getElementById('replay-again-btn');
const balanceHud = document.getElementById('balance-hud');
const statsEl = document.getElementById('stats');
const complianceDevEl = document.getElementById('compliance-dev');
const sessionTimerStat = document.getElementById('session-timer-stat');
const sessionTimerEl = document.getElementById('session-timer');
const modeRow = document.getElementById('mode-row');
const modeCostEl = document.getElementById('mode-cost');
const betChips = document.getElementById('bet-chips');
const outcomeCard = document.getElementById('outcome-card');
const outcomeSymbol = document.getElementById('outcome-symbol');
const outcomeMult = document.getElementById('outcome-mult');
const balanceLabelEl = document.getElementById('balance-label');
const betLabelEl = document.getElementById('bet-label');
const lastResultLabelEl = document.getElementById('last-result-label');
const replayNoteEl = document.getElementById('replay-note');
const principlesAside = document.querySelector('.principles');
const testControlsRow = document.querySelector('.test-row');

document.getElementById('game-title').textContent = GAME.title;
document.getElementById('game-subtitle').textContent = GAME.subtitle;

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

function copyTerm(key) {
  return game.copy.term(key);
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

function modeButtonLabel(mode) {
  if (mode.key === 'base') return 'Base';
  if (mode.type === 'buy') return `Buy bonus ×${mode.costMultiplier}`;
  if (mode.type === 'activate') return `Ante ×${mode.costMultiplier}`;
  return mode.key;
}

function playButtonLabel() {
  if (game.betModes.isBuyMode()) return 'Buy & play';
  return copyTerm('drop');
}

function renderModeSelector() {
  modeRow.innerHTML = '';
  const modes = game.betModes.modes;
  if (modes.length <= 1) {
    modeRow.hidden = true;
    modeCostEl.hidden = true;
    return;
  }

  modeRow.hidden = false;
  for (const mode of modes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.mode = mode.key;
    btn.className = `mode-btn${mode.key === game.betModes.activeKey ? ' active' : ''}${mode.type === 'buy' ? ' buy' : ''}`;
    btn.textContent = modeButtonLabel(mode);
    if (mode.type === 'buy' && !game.controls.canBuyFeature) {
      btn.title = 'Buy feature disabled for this jurisdiction';
    }
    btn.addEventListener('click', () => selectMode(mode.key));
    modeRow.appendChild(btn);
  }
  syncModeCostHint();
}

function selectMode(key) {
  if (playing || autoplaying) return;
  if (!game.betModes.setActiveMode(key)) return;
  renderModeSelector();
  syncHud();
  syncControls();
}

function syncModeCostHint() {
  const active = game.betModes.getActiveMode();
  if (!active || active.costMultiplier <= 1) {
    modeCostEl.hidden = true;
    return;
  }
  modeCostEl.hidden = false;
  modeCostEl.textContent = `Play cost ${fmt(playCostDisplay())} — base ${fmt(bet)} × ${active.costMultiplier}`;
}

function syncHud() {
  balanceEl.textContent = replayMode ? '—' : fmt(balance);
  betEl.textContent = fmt(bet);
  const rtpPart = game.controls.showRtp ? ` · target RTP ${GAME.targetRtpPercent}%` : '';
  const modePart = game.betModes.modes.length > 1 ? ' · base + buy bonus' : '';
  statsEl.textContent = `Starter math · 3 outcomes · Stake-shaped lifecycle${modePart}${rtpPart}`;
  syncModeCostHint();
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

function renderBetChips() {
  betChips.innerHTML = '';
  for (const amount of betOptions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip${amount === bet ? ' active' : ''}`;
    btn.textContent = fmt(amount);
    btn.addEventListener('click', () => {
      if (playing || autoplaying) return;
      bet = amount;
      renderBetChips();
      syncHud();
    });
    betChips.appendChild(btn);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function syncControls() {
  if (replayMode) {
    replayAgainBtn.disabled = playing || !replayRound;
    return;
  }

  const busy = playing || autoplaying;
  autoplayBtn.disabled = busy || !game.rgsReady || !game.controls.canAutoplay;
  newSessionBtn.disabled = busy;
  copyReplayBtn.disabled = busy || !lastReplayUrl;

  for (const chip of betChips.querySelectorAll('button')) {
    chip.disabled = busy;
  }

  for (const btn of modeRow.querySelectorAll('button')) {
    const key = btn.dataset.mode;
    btn.disabled = busy || !game.betModes.canSelectMode(key);
    btn.classList.toggle('active', key === game.betModes.activeKey);
  }

  if (autoplaying || !game.rgsReady) {
    playBtn.textContent = playButtonLabel();
    playBtn.classList.remove('fast');
    playBtn.disabled = true;
    return;
  }

  if (playing) {
    if (game.controls.canTurbo) {
      playBtn.textContent = 'Fast';
      playBtn.classList.add('fast');
      playBtn.disabled = false;
    } else {
      playBtn.textContent = playButtonLabel();
      playBtn.classList.remove('fast');
      playBtn.disabled = true;
    }
    return;
  }

  playBtn.textContent = playButtonLabel();
  playBtn.classList.remove('fast');
  playBtn.disabled = false;
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
      testControls: testControlsRow,
      copyReplay: copyReplayBtn,
      autoplay: autoplayBtn,
      newSession: newSessionBtn,
      devAside: principlesAside,
      sessionTimer: sessionTimerEl,
      sessionTimerContainer: sessionTimerStat,
      balanceLabel: balanceLabelEl,
      betLabel: betLabelEl,
      lastResultLabel: lastResultLabelEl,
      replayNote: replayNoteEl,
      dropButton: playBtn,
    },
    screenPreview: { root: document.querySelector('.suki-stake-shell') },
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
      copyReplayBtn.hidden = false;
      syncControls();

      displayRoundResult({
        symbol: result.symbol,
        multiplier: result.multiplier,
        payout,
        profit: payout - debitDisplay,
      });
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
        betOptions = auth.betLevelsDisplay;
        bet = auth.defaultBetDisplay ?? betOptions[0];
        renderBetChips();
      }
      renderModeSelector();
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
    renderModeSelector();
    syncControls();
    syncHud();
  },
  replay: { start: bootstrapReplay },
});

const { controls, lifecycle, applyAuthConfig, syncDevTools } = game;

renderModeSelector();

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

async function onAutoplay100() {
  if (playing || autoplaying || !controls.canAutoplay) return;
  if (!game.rgsReady || balance < playCostDisplay()) return;

  autoplaying = true;
  syncControls();
  let count = 0;
  try {
    for (let i = 0; i < 100; i += 1) {
      if (balance < playCostDisplay()) {
        setMessage(`${copyTerm('autoplayStopped')} ${count} plays.`);
        break;
      }
      setMessage(`Autoplay ${i + 1}/100…`);
      await lifecycle.executeDrop({ animate: false });
      count += 1;
    }
    if (count === 100) setMessage('Autoplay finished — 100 plays.');
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
  playControls.hidden = false;
  replayControls.hidden = true;
  balanceHud.hidden = false;
}

function setReplayModeUi() {
  replayBanner.hidden = false;
  playControls.hidden = true;
  replayControls.hidden = false;
  balanceHud.hidden = true;
  copyReplayBtn.hidden = true;
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

playBtn.addEventListener('click', () => {
  if (playing && controls.canTurbo) {
    animationSpeed = 3;
    return;
  }
  onPlay();
});

autoplayBtn.addEventListener('click', onAutoplay100);
newSessionBtn.addEventListener('click', () => {
  startNewRgsSession();
  lastReplayUrl = '';
  copyReplayBtn.hidden = true;
  setMessage('New session — reconnecting…');
  game.start();
});

copyReplayBtn.addEventListener('click', async () => {
  if (!lastReplayUrl) return;
  try {
    await navigator.clipboard.writeText(lastReplayUrl);
    setMessage('Replay link copied.');
  } catch {
    setMessage(lastReplayUrl);
  }
});

replayAgainBtn.addEventListener('click', () => {
  if (replayRound) playReplayAnimation(replayRound);
});

if (replayMode) {
  setReplayModeUi();
} else {
  setPlayModeUi();
}

renderBetChips();
syncHud();
syncDevTools();
syncControls();
game.start();
