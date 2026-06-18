const STYLE_ID = 'suki-autoplay-confirm-styles';

export const AUTOPLAY_CONFIRM_MODAL_ID = 'suki-autoplay-confirm';
export const DEFAULT_AUTOPLAY_ROUNDS = [10, 25, 50, 100];
export const AUTOPLAY_MIN_ROUNDS = 1;
export const AUTOPLAY_MAX_ROUNDS = 999;

const CONFIRM_CSS = `
.suki-autoplay-summary {
  margin: 0 0 0.85rem;
  color: #9aa8bc;
  font-size: 0.84rem;
}
.suki-autoplay-rounds {
  margin-bottom: 0.85rem;
}
.suki-autoplay-rounds-label {
  display: block;
  margin-bottom: 0.45rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #7d8da3;
}
.suki-autoplay-rounds-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.suki-autoplay-round-btn {
  min-width: 3rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid #2a3344;
  border-radius: 8px;
  background: #12161e;
  color: #c5d0de;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.suki-autoplay-round-btn.active {
  border-color: #4a9eff;
  background: #1a2a3d;
  color: #e8edf4;
}
.suki-autoplay-rounds-custom {
  margin-top: 0.65rem;
}
.suki-autoplay-rounds-custom-label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #7d8da3;
}
.suki-autoplay-rounds-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.65rem;
  border: 1px solid #2a3344;
  border-radius: 8px;
  background: #12161e;
  color: #e8edf4;
  font-size: 0.9rem;
  font-weight: 600;
}
.suki-autoplay-rounds-input:focus {
  outline: none;
  border-color: #4a9eff;
}
.suki-autoplay-rounds-input.custom-active {
  border-color: #4a9eff;
}
.suki-autoplay-cost {
  margin: 0 0 1rem;
  font-size: 0.84rem;
  color: #c5d0de;
}
.suki-autoplay-actions {
  display: flex;
  gap: 0.5rem;
}
.suki-autoplay-cancel,
.suki-autoplay-start {
  flex: 1;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}
.suki-autoplay-cancel {
  border: 1px solid #2a3344;
  background: #0a0c10;
  color: #9aa8bc;
}
.suki-autoplay-start {
  border: 1px solid #2f6fbf;
  background: #1a4a8a;
  color: #f0f6ff;
}
.suki-autoplay-start:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`;

/**
 * Strip non-digit characters from autoplay round input.
 * @param {unknown} value
 */
export function sanitizeAutoplayRoundDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * @param {unknown} raw
 * @param {{ min?: number, max?: number, fallback?: number | null }} [options]
 */
export function parseAutoplayRoundCount(raw, options = {}) {
  const {
    min = AUTOPLAY_MIN_ROUNDS,
    max = AUTOPLAY_MAX_ROUNDS,
    fallback = null,
  } = options;
  const digits = sanitizeAutoplayRoundDigits(raw);
  if (!digits) return fallback;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(max, Math.trunc(parsed));
}

/**
 * @param {HTMLInputElement} input
 * @param {number} rounds
 */
function setCustomRoundInputValue(input, rounds) {
  input.value = String(rounds);
}

/**
 * @param {KeyboardEvent} event
 */
export function shouldBlockAutoplayRoundKey(event) {
  const allowed = new Set([
    'Backspace',
    'Delete',
    'Tab',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ]);
  if (allowed.has(event.key)) return false;
  if (event.ctrlKey || event.metaKey) return false;
  return !/^\d$/.test(event.key);
}

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CONFIRM_CSS;
  document.head.appendChild(el);
}

/**
 * Two-step autoplay — first click opens modal; start only after explicit confirm.
 *
 * @param {ReturnType<import('./modalHost.js').createModalHost>} modalHost
 * @param {object} options
 * @param {(key: string, vars?: Record<string, string | number>) => string} options.t
 * @param {() => number} options.getPlayCost — display units per round
 * @param {() => number} [options.getBalance] — display units
 * @param {(amount: number) => string} [options.formatCurrency]
 * @param {number[]} [options.roundOptions]
 * @param {number} [options.defaultRounds]
 * @param {number} [options.minRounds]
 * @param {number} [options.maxRounds]
 * @param {(rounds: number) => void} options.onConfirm
 */
export function registerAutoplayConfirm(modalHost, options) {
  const {
    t,
    getPlayCost,
    getBalance = () => 0,
    formatCurrency = (amount) => String(amount),
    roundOptions = DEFAULT_AUTOPLAY_ROUNDS,
    defaultRounds = roundOptions[roundOptions.length - 1] ?? 100,
    minRounds = AUTOPLAY_MIN_ROUNDS,
    maxRounds = AUTOPLAY_MAX_ROUNDS,
    onConfirm,
  } = options;

  ensureStyles();

  let selectedRounds = defaultRounds;
  let usingCustomRounds = false;

  function canAfford() {
    return getBalance() >= getPlayCost();
  }

  function renderBody(body) {
    body.innerHTML = '';

    const summary = document.createElement('p');
    summary.className = 'suki-autoplay-summary';
    summary.textContent = t('autoplaySummary');

    const roundsBlock = document.createElement('div');
    roundsBlock.className = 'suki-autoplay-rounds';

    const roundsLabel = document.createElement('span');
    roundsLabel.className = 'suki-autoplay-rounds-label';
    roundsLabel.textContent = t('autoplayRoundsLabel');

    const roundsRow = document.createElement('div');
    roundsRow.className = 'suki-autoplay-rounds-options';
    roundsRow.setAttribute('role', 'group');
    roundsRow.setAttribute('aria-label', t('autoplayRoundsLabel'));

    const customBlock = document.createElement('div');
    customBlock.className = 'suki-autoplay-rounds-custom';

    const customLabel = document.createElement('label');
    customLabel.className = 'suki-autoplay-rounds-custom-label';
    customLabel.textContent = t('autoplayCustomRoundsLabel');

    const customInput = document.createElement('input');
    customInput.type = 'number';
    customInput.className = 'suki-autoplay-rounds-input';
    customInput.min = String(minRounds);
    customInput.max = String(maxRounds);
    customInput.step = '1';
    customInput.inputMode = 'numeric';
    customInput.autocomplete = 'off';
    customInput.setAttribute('aria-label', t('autoplayCustomRoundsLabel'));
    customLabel.htmlFor = 'suki-autoplay-rounds-input';
    customInput.id = 'suki-autoplay-rounds-input';

    const cost = document.createElement('p');
    cost.className = 'suki-autoplay-cost';
    cost.textContent = t('autoplayCostLine', {
      playCost: formatCurrency(getPlayCost()),
    });

    const actions = document.createElement('div');
    actions.className = 'suki-autoplay-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'suki-autoplay-cancel';
    cancelBtn.textContent = t('autoplayCancel');
    cancelBtn.addEventListener('click', () => modalHost.close());

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'suki-autoplay-start';
    startBtn.textContent = t('autoplayStart');

    function syncPresetButtons() {
      for (const chip of roundsRow.querySelectorAll('.suki-autoplay-round-btn')) {
        const chipRounds = Number(chip.dataset.rounds);
        chip.classList.toggle('active', !usingCustomRounds && chipRounds === selectedRounds);
      }
      customInput.classList.toggle('custom-active', usingCustomRounds);
    }

    function syncStartButton() {
      const rounds = parseAutoplayRoundCount(customInput.value, {
        min: minRounds,
        max: maxRounds,
        fallback: null,
      });
      startBtn.disabled = !canAfford() || rounds == null;
    }

    function selectPresetRounds(rounds) {
      selectedRounds = rounds;
      usingCustomRounds = false;
      setCustomRoundInputValue(customInput, rounds);
      syncPresetButtons();
      syncStartButton();
    }

    function applyCustomInput(rawValue = customInput.value) {
      const digits = sanitizeAutoplayRoundDigits(rawValue);
      if (digits !== String(rawValue)) {
        customInput.value = digits;
      }
      const parsed = parseAutoplayRoundCount(digits, {
        min: minRounds,
        max: maxRounds,
        fallback: null,
      });
      if (parsed != null) {
        selectedRounds = parsed;
        usingCustomRounds = !roundOptions.includes(parsed);
        if (!usingCustomRounds) {
          customInput.value = String(parsed);
        }
      } else {
        usingCustomRounds = true;
      }
      syncPresetButtons();
      syncStartButton();
    }

    for (const rounds of roundOptions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suki-autoplay-round-btn';
      btn.dataset.rounds = String(rounds);
      btn.textContent = String(rounds);
      btn.addEventListener('click', () => selectPresetRounds(rounds));
      roundsRow.appendChild(btn);
    }

    customInput.addEventListener('keydown', (event) => {
      if (shouldBlockAutoplayRoundKey(event)) {
        event.preventDefault();
      }
    });

    customInput.addEventListener('paste', (event) => {
      event.preventDefault();
      const pasted = event.clipboardData?.getData('text') ?? '';
      const digits = sanitizeAutoplayRoundDigits(pasted).slice(0, String(maxRounds).length);
      customInput.value = digits;
      applyCustomInput(digits);
    });

    customInput.addEventListener('input', () => {
      applyCustomInput();
    });

    customInput.addEventListener('focus', () => {
      usingCustomRounds = true;
      syncPresetButtons();
    });

    startBtn.addEventListener('click', () => {
      const rounds = parseAutoplayRoundCount(customInput.value, {
        min: minRounds,
        max: maxRounds,
        fallback: selectedRounds,
      });
      if (!canAfford() || rounds == null) return;
      modalHost.close();
      onConfirm(rounds);
    });

    customBlock.append(customLabel, customInput);
    roundsBlock.append(roundsLabel, roundsRow, customBlock);
    actions.append(cancelBtn, startBtn);
    body.append(summary, roundsBlock, cost, actions);

    selectPresetRounds(selectedRounds);
  }

  modalHost.register(AUTOPLAY_CONFIRM_MODAL_ID, {
    title: t('autoplayTitle'),
    render: renderBody,
  });

  return {
    open() {
      selectedRounds = defaultRounds;
      usingCustomRounds = false;
      modalHost.open(AUTOPLAY_CONFIRM_MODAL_ID);
    },
    close() {
      modalHost.close();
    },
  };
}
