const STYLE_ID = 'suki-autoplay-confirm-styles';

export const AUTOPLAY_CONFIRM_MODAL_ID = 'suki-autoplay-confirm';
export const DEFAULT_AUTOPLAY_ROUNDS = [10, 25, 50, 100];

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
    onConfirm,
  } = options;

  ensureStyles();

  let selectedRounds = defaultRounds;

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

    for (const rounds of roundOptions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `suki-autoplay-round-btn${rounds === selectedRounds ? ' active' : ''}`;
      btn.textContent = String(rounds);
      btn.addEventListener('click', () => {
        selectedRounds = rounds;
        for (const chip of roundsRow.querySelectorAll('.suki-autoplay-round-btn')) {
          chip.classList.toggle('active', chip.textContent === String(rounds));
        }
      });
      roundsRow.appendChild(btn);
    }

    roundsBlock.append(roundsLabel, roundsRow);

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
    startBtn.disabled = !canAfford();
    startBtn.addEventListener('click', () => {
      if (!canAfford()) return;
      modalHost.close();
      onConfirm(selectedRounds);
    });

    actions.append(cancelBtn, startBtn);
    body.append(summary, roundsBlock, cost, actions);
  }

  modalHost.register(AUTOPLAY_CONFIRM_MODAL_ID, {
    title: t('autoplayTitle'),
    render: renderBody,
  });

  return {
    open() {
      selectedRounds = defaultRounds;
      modalHost.open(AUTOPLAY_CONFIRM_MODAL_ID);
    },
    close() {
      modalHost.close();
    },
  };
}
