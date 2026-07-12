const STYLE_ID = 'suki-buy-confirm-styles';

export const BUY_BONUS_CONFIRM_MODAL_ID = 'suki-buy-bonus-confirm';

const CONFIRM_CSS = `
.suki-buy-summary {
  margin: 0 0 0.75rem;
  color: #9aa8bc;
  font-size: 0.84rem;
}
.suki-buy-detail {
  margin: 0 0 0.85rem;
  color: #c5d0de;
  font-size: 0.84rem;
}
.suki-buy-cost {
  margin: 0 0 1rem;
  font-size: 0.84rem;
  color: #e8edf4;
  font-weight: 600;
}
.suki-buy-actions {
  display: flex;
  gap: 0.5rem;
}
.suki-buy-cancel,
.suki-buy-confirm {
  flex: 1;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}
.suki-buy-cancel {
  border: 1px solid #2a3344;
  background: #0a0c10;
  color: #9aa8bc;
}
.suki-buy-confirm {
  border: 1px solid #2f6fbf;
  background: #1a4a8a;
  color: #f0f6ff;
}
.suki-buy-confirm:disabled {
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
 * Two-step buy-bonus — first click opens modal; purchase only after explicit confirm.
 * Required when mode cost multiplier is greater than 2× (Stake compliance).
 *
 * @param {ReturnType<import('./modalHost.js').createModalHost>} modalHost
 * @param {object} options
 * @param {(key: string, vars?: Record<string, string | number>) => string} options.t
 * @param {() => number} options.getBuyCost — display units (total debit)
 * @param {() => number} options.getBaseBet — display units
 * @param {() => number} options.getCostMultiplier
 * @param {(amount: number) => string} [options.formatCurrency]
 * @param {() => boolean} [options.getCanConfirm]
 * @param {() => string} [options.getFeatureDetail] — optional game-specific feature copy
 * @param {() => void} options.onConfirm
 */
export function registerBuyBonusConfirm(modalHost, options) {
  const {
    t,
    getBuyCost,
    getBaseBet,
    getCostMultiplier,
    formatCurrency = (amount) => String(amount),
    getCanConfirm = () => true,
    getFeatureDetail = null,
    onConfirm,
  } = options;

  ensureStyles();

  function renderBody(body) {
    body.innerHTML = '';

    const summary = document.createElement('p');
    summary.className = 'suki-buy-summary';
    summary.textContent = t('buyConfirmSummary', {
      costMult: String(getCostMultiplier()),
    });

    const detail = document.createElement('p');
    detail.className = 'suki-buy-detail';
    detail.textContent = getFeatureDetail?.() ?? t('buyConfirmFeatureDetail');

    const cost = document.createElement('p');
    cost.className = 'suki-buy-cost';
    cost.textContent = t('modeCostLine', {
      playLabel: t('buyConfirmTotalLabel'),
      playCost: formatCurrency(getBuyCost()),
      baseLabel: t('baseBetLabel'),
      baseAmount: formatCurrency(getBaseBet()),
      multLabel: t('costMultiplierLabel'),
      costMult: String(getCostMultiplier()),
    });

    const actions = document.createElement('div');
    actions.className = 'suki-buy-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'suki-buy-cancel';
    cancelBtn.textContent = t('buyConfirmCancel');
    cancelBtn.addEventListener('click', () => modalHost.close());

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'suki-buy-confirm';
    confirmBtn.textContent = t('buyPlayButton');
    confirmBtn.disabled = !getCanConfirm();

    confirmBtn.addEventListener('click', () => {
      if (!getCanConfirm()) return;
      modalHost.close();
      onConfirm();
    });

    actions.append(cancelBtn, confirmBtn);
    body.append(summary, detail, cost, actions);
  }

  modalHost.register(BUY_BONUS_CONFIRM_MODAL_ID, {
    title: t('buyConfirmTitle'),
    render: renderBody,
  });

  return {
    open() {
      modalHost.open(BUY_BONUS_CONFIRM_MODAL_ID);
    },
    close() {
      modalHost.close();
    },
  };
}
