import { apiToDisplay, displayToApi } from '../money.js';
import { registerAutoplayConfirm } from './autoplayConfirm.js';

/**
 * @typedef {object} PlayButtonState
 * @property {string} label
 * @property {boolean} disabled
 * @property {boolean} turbo
 */

/**
 * @param {object} input
 * @param {boolean} input.replayMode
 * @param {boolean} input.busy
 * @param {boolean} input.playing
 * @param {boolean} input.autoplaying
 * @param {boolean} input.rgsReady
 * @param {boolean} input.canTurbo
 * @param {boolean} [input.canAffordPlay=true]
 * @param {string} input.playLabel
 * @param {string} [input.turboLabel='Fast']
 * @returns {PlayButtonState}
 */
export function resolvePlayButtonState(input) {
  const {
    replayMode,
    busy,
    playing,
    autoplaying,
    rgsReady,
    canTurbo,
    canAffordPlay = true,
    playLabel,
    turboLabel = 'Fast',
  } = input;

  if (replayMode) {
    return { label: playLabel, disabled: true, turbo: false };
  }
  if (autoplaying || !rgsReady) {
    return { label: playLabel, disabled: true, turbo: false };
  }
  if (!canAffordPlay) {
    return { label: playLabel, disabled: true, turbo: false };
  }
  if (playing && canTurbo) {
    return { label: turboLabel, disabled: false, turbo: true };
  }
  if (playing) {
    return { label: playLabel, disabled: true, turbo: false };
  }
  return { label: playLabel, disabled: false, turbo: false };
}

/**
 * @param {{ key: string, type?: string, costMultiplier?: number }} mode
 */
export function modeButtonLabel(mode) {
  if (mode.key === 'base') return 'Base';
  if (mode.type === 'buy') return `Buy bonus ×${mode.costMultiplier}`;
  if (mode.type === 'activate') return `Ante ×${mode.costMultiplier}`;
  return mode.key;
}

/**
 * Mount the standard Suki betting shell (DOM only). Call `bind()` after `createGameBootstrap`.
 *
 * @param {object} options
 * @param {HTMLElement} options.root — `.suki-controls-slot`
 * @param {boolean} [options.showModeRow=true]
 * @param {Record<string, HTMLElement>} [options.slots] — optional mount points: beforeModes, beforePlay, afterPlay
 */
export function createBetUi(options) {
  const { root, showModeRow = true, slots = {} } = options;

  root.innerHTML = '';
  root.classList.add('suki-bet-ui-root');

  const ui = document.createElement('div');
  ui.className = 'suki-bet-ui';
  ui.dataset.sukiBetUi = '';

  const playPanel = document.createElement('div');
  playPanel.className = 'suki-bet-play-panel';

  if (slots.beforeModes) {
    playPanel.appendChild(slots.beforeModes);
  }

  const modeRow = document.createElement('div');
  modeRow.className = 'suki-bet-modes';
  modeRow.setAttribute('aria-label', 'Play mode');
  modeRow.hidden = !showModeRow;

  const modeCost = document.createElement('p');
  modeCost.className = 'suki-bet-mode-cost';
  modeCost.hidden = true;

  const betChips = document.createElement('div');
  betChips.className = 'suki-bet-chips';
  betChips.setAttribute('aria-label', 'Bet amount');

  if (slots.beforePlay) {
    playPanel.appendChild(slots.beforePlay);
  }

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'suki-bet-play';
  playBtn.textContent = 'Play';

  const devRow = document.createElement('div');
  devRow.className = 'suki-bet-dev';
  devRow.dataset.sukiDev = '';

  const autoplayBtn = document.createElement('button');
  autoplayBtn.type = 'button';
  autoplayBtn.className = 'suki-bet-dev-btn';
  autoplayBtn.textContent = '100 play';

  const newSessionBtn = document.createElement('button');
  newSessionBtn.type = 'button';
  newSessionBtn.className = 'suki-bet-dev-btn';
  newSessionBtn.textContent = 'New session';

  const copyReplayBtn = document.createElement('button');
  copyReplayBtn.type = 'button';
  copyReplayBtn.className = 'suki-bet-dev-btn suki-bet-copy-replay';
  copyReplayBtn.textContent = 'Copy replay link';
  copyReplayBtn.hidden = true;

  devRow.append(autoplayBtn, newSessionBtn, copyReplayBtn);
  playPanel.append(modeRow, modeCost, betChips, playBtn, devRow);

  if (slots.afterPlay) {
    playPanel.appendChild(slots.afterPlay);
  }

  const replayPanel = document.createElement('div');
  replayPanel.className = 'suki-bet-replay-panel';
  replayPanel.hidden = true;

  const replayAgainBtn = document.createElement('button');
  replayAgainBtn.type = 'button';
  replayAgainBtn.className = 'suki-bet-dev-btn';
  replayAgainBtn.textContent = 'Replay again';
  replayPanel.appendChild(replayAgainBtn);

  ui.append(playPanel, replayPanel);
  root.appendChild(ui);

  /** @type {object | null} */
  let game = null;
  let getBet = () => 0;
  let setBet = () => {};
  let getBetOptions = () => /** @type {number[]} */ ([]);
  let setBetOptions = () => {};
  let getBusy = () => false;
  let getPlaying = () => false;
  let getAutoplaying = () => false;
  /** @type {(() => void) | null} */
  let onBetChange = null;
  /** @type {(() => void) | null} */
  let onModeChange = null;
  /** @type {(() => void) | null} */
  let onPlay = null;
  /** @type {(() => void) | null} */
  let onTurbo = null;
  /** @type {(() => void) | null} */
  let onAutoplay = null;
  /** @type {(() => void) | null} */
  let onNewSession = null;
  /** @type {(() => void) | null} */
  let onCopyReplay = null;
  /** @type {(() => void) | null} */
  let onReplayAgain = null;
  let onDismissOverlays = null;
  /** @type {(() => string) | null} */
  let getPlayLabel = null;
  /** @type {(() => number) | null} */
  let getPlayCost = null;
  /** @type {(() => number) | null} */
  let getBalance = null;
  /** @type {((amount: number) => string) | null} */
  let formatCurrency = null;
  /** @type {ReturnType<typeof registerAutoplayConfirm> | null} */
  let autoplayConfirm = null;
  let turboDisablesButton = false;
  let replayMode = false;
  let lastReplayUrl = '';
  /** @type {(key: string, vars?: Record<string, string | number>) => string} */
  let getCopyTerm = (key) => key;

  const elements = {
    playPanel,
    replayPanel,
    dropButton: playBtn,
    modeRow,
    modeCost,
    betChips,
    testControls: devRow,
    autoplay: autoplayBtn,
    newSession: newSessionBtn,
    copyReplay: copyReplayBtn,
    replayAgain: replayAgainBtn,
  };

  function fmt(amount) {
    return game?.formatCurrency(amount) ?? String(amount);
  }

  function defaultPlayLabel() {
    if (getPlayLabel) return getPlayLabel();
    if (game?.betModes?.isBuyMode?.()) return 'Buy & play';
    return game?.copy?.term('drop') ?? 'Play';
  }

  function playCostDisplay() {
    if (getPlayCost) return getPlayCost();
    if (!game) return getBet();
    const baseApi = displayToApi(getBet());
    const playApi = game.betModes.playAmountApi(baseApi);
    return apiToDisplay(playApi);
  }

  function syncLocalizedLabels() {
    betChips.setAttribute('aria-label', getCopyTerm('betAmount'));
    modeRow.setAttribute('aria-label', getCopyTerm('playModeLabel'));
    replayAgainBtn.textContent = getCopyTerm('replayAgain');
    autoplayBtn.textContent = getCopyTerm('autoplayButton');
  }

  function syncModeCostHint() {
    const active = game?.betModes?.getActiveMode?.();
    if (!active || active.costMultiplier <= 1) {
      modeCost.hidden = true;
      return;
    }
    modeCost.hidden = false;
    modeCost.textContent = getCopyTerm('modeCostLine', {
      playLabel: getCopyTerm('replayPlayLabel'),
      playCost: fmt(playCostDisplay()),
      baseLabel: getCopyTerm('baseBetLabel'),
      baseAmount: fmt(getBet()),
      multLabel: getCopyTerm('costMultiplierLabel'),
      costMult: active.costMultiplier,
    });
  }

  function renderModes() {
    modeRow.innerHTML = '';
    if (!showModeRow || !game) {
      modeRow.hidden = true;
      modeCost.hidden = true;
      return;
    }

    const modes = game.betModes.modes;
    if (modes.length <= 1) {
      modeRow.hidden = true;
      modeCost.hidden = true;
      return;
    }

    modeRow.hidden = false;
    for (const mode of modes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.mode = mode.key;
      btn.className = `suki-bet-mode-btn${mode.key === game.betModes.activeKey ? ' active' : ''}${mode.type === 'buy' ? ' buy' : ''}`;
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
    if (getBusy()) return;
    if (!game?.betModes?.setActiveMode(key)) return;
    renderModes();
    onModeChange?.();
    sync();
  }

  function renderBetLevels() {
    betChips.innerHTML = '';
    for (const amount of getBetOptions()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `suki-bet-chip${amount === getBet() ? ' active' : ''}`;
      btn.textContent = fmt(amount);
      btn.addEventListener('click', () => {
        if (getBusy()) return;
        setBet(amount);
        renderBetLevels();
        onBetChange?.();
        syncModeCostHint();
      });
      betChips.appendChild(btn);
    }
  }

  function canAffordPlay() {
    if (!getBalance) return true;
    return getBalance() >= playCostDisplay();
  }

  function sync() {
    if (replayMode) {
      replayAgainBtn.disabled = getBusy() || !onReplayAgain;
      return;
    }

    const busy = getBusy();
    const playing = getPlaying();
    const autoplaying = getAutoplaying();

    autoplayBtn.disabled = busy || !game?.rgsReady || !game?.controls?.canAutoplay || !canAffordPlay();
    newSessionBtn.disabled = busy;
    copyReplayBtn.disabled = busy || !lastReplayUrl;

    for (const chip of betChips.querySelectorAll('button')) {
      chip.disabled = busy;
    }

    for (const btn of modeRow.querySelectorAll('button')) {
      const key = btn.dataset.mode;
      btn.disabled = busy || !game?.betModes?.canSelectMode(key);
      btn.classList.toggle('active', key === game?.betModes?.activeKey);
    }

    const state = resolvePlayButtonState({
      replayMode,
      busy,
      playing,
      autoplaying,
      rgsReady: !!game?.rgsReady,
      canTurbo: !!game?.controls?.canTurbo,
      canAffordPlay: canAffordPlay(),
      playLabel: defaultPlayLabel(),
    });

    playBtn.textContent = state.label;
    playBtn.classList.toggle('turbo', state.turbo);
    playBtn.disabled = state.disabled;
    syncModeCostHint();
  }

  function setView(view) {
    const isReplay = view === 'replay';
    playPanel.hidden = isReplay;
    replayPanel.hidden = !isReplay;
  }

  function setLastReplayUrl(url) {
    lastReplayUrl = url || '';
    copyReplayBtn.hidden = !lastReplayUrl;
    sync();
  }

  function setBetLevels(levels, defaultBet) {
    if (levels?.length) {
      setBetOptions(levels);
      setBet(defaultBet ?? levels[0]);
      renderBetLevels();
    }
  }

  function dismissOverlays() {
    onDismissOverlays?.();
  }

  playBtn.addEventListener('click', () => {
    if (getPlaying() && game?.controls?.canTurbo) {
      dismissOverlays();
      onTurbo?.();
      if (turboDisablesButton) {
        playBtn.disabled = true;
      }
      return;
    }
    if (!getBusy()) {
      dismissOverlays();
      onPlay?.();
    }
  });

  autoplayBtn.addEventListener('click', () => {
    dismissOverlays();
    if (autoplayConfirm) {
      autoplayConfirm.open();
      return;
    }
    onAutoplay?.(100);
  });
  newSessionBtn.addEventListener('click', () => onNewSession?.());
  copyReplayBtn.addEventListener('click', () => onCopyReplay?.());
  replayAgainBtn.addEventListener('click', () => onReplayAgain?.());

  const api = {
    elements,
    bind(handlers) {
      game = handlers.game;
      getBet = handlers.getBet ?? getBet;
      setBet = handlers.setBet ?? setBet;
      getBetOptions = handlers.getBetOptions ?? getBetOptions;
      setBetOptions = handlers.setBetOptions ?? setBetOptions;
      getBusy = handlers.getBusy ?? getBusy;
      getPlaying = handlers.getPlaying ?? (() => false);
      getAutoplaying = handlers.getAutoplaying ?? (() => false);
      onBetChange = handlers.onBetChange ?? null;
      onModeChange = handlers.onModeChange ?? null;
      onPlay = handlers.onPlay ?? null;
      onTurbo = handlers.onTurbo ?? null;
      onAutoplay = handlers.onAutoplay ?? null;
      onNewSession = handlers.onNewSession ?? null;
      onCopyReplay = handlers.onCopyReplay ?? null;
      onReplayAgain = handlers.onReplayAgain ?? null;
      onDismissOverlays = handlers.onDismissOverlays ?? null;
      getPlayLabel = handlers.getPlayLabel ?? null;
      getPlayCost = handlers.getPlayCost ?? null;
      getBalance = handlers.getBalance ?? null;
      getCopyTerm = handlers.getCopyTerm ?? ((key, vars) => game?.copy?.t?.(key, vars) ?? key);
      formatCurrency = handlers.formatCurrency ?? ((amount) => game?.formatCurrency?.(amount) ?? String(amount));
      turboDisablesButton = handlers.turboDisablesButton ?? false;
      replayMode = handlers.replayMode ?? false;

      if (handlers.modalHost) {
        autoplayConfirm = registerAutoplayConfirm(handlers.modalHost, {
          t: getCopyTerm,
          getPlayCost: () => playCostDisplay(),
          getBalance: () => getBalance?.() ?? 0,
          formatCurrency: (amount) => formatCurrency(amount),
          onConfirm: (rounds) => onAutoplay?.(rounds),
        });
      } else {
        autoplayConfirm = null;
      }

      syncLocalizedLabels();
      renderModes();
      renderBetLevels();
      sync();
      return api;
    },
    renderModes,
    renderBetLevels,
    setBetLevels,
    sync,
    setView,
    setLastReplayUrl,
    syncModeCostHint,
    syncLocalizedLabels,
    destroy() {
      root.innerHTML = '';
      root.classList.remove('suki-bet-ui-root');
    },
  };

  return api;
}
