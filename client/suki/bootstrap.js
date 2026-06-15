import { authenticate, fetchBalance, getRgsParams, isReplayMode } from '../rgs.js';
import { messageForRgsCode, isSessionFatal } from './errors.js';
import { getDevComplianceLabel } from './config.js';
import { rgsOfflineMessage } from './productionUi.js';
import { withRgsCall } from './rgsTransport.js';
import { validateRgsConfig } from './rgsConfig.js';
import { getEnvironment } from './environment.js';
import {
  isConnectionFailure,
  notifyRgsConnectionLost,
  notifyRgsConnectionRestored,
} from './rgsConnection.js';

export { getDevComplianceLabel };

/**
 * @param {object} ctx
 * @param {(data: object) => void} ctx.applyAuthConfig
 * @param {object} ctx.lifecycle — createSukiLifecycle()
 * @param {(text: string) => void} ctx.setMessage
 * @param {() => void} ctx.onReady
 * @param {(ready: boolean) => void} ctx.setRgsReady
 * @param {(outcome: object) => void} [ctx.onAuthRound]
 */
export async function bootstrapPlayMode(ctx) {
  const { applyAuthConfig, lifecycle, setMessage, onReady, setRgsReady } = ctx;
  setMessage(ctx.connectingMessage ?? 'Connecting to RGS…');

  try {
    const environment = getEnvironment();
    const validation = validateRgsConfig(getRgsParams(), environment);
    if (!validation.ok) {
      setRgsReady(false);
      setMessage(ctx.invalidRgsMessage ?? validation.issues.join(' · '));
      return;
    }

    const data = await withRgsCall(() => authenticate());
    applyAuthConfig(data);
    setRgsReady(true);
    notifyRgsConnectionRestored();

    const authOutcome = await lifecycle.handleAuthRound(data.round, {
      lastEvent: data.meta?.lastEvent,
    });

    ctx.onAuthRound?.(authOutcome);

    if (authOutcome.status === 'ready') {
      setMessage(ctx.readyMessage ?? 'Set bet · press Drop.');
    }
    onReady();
  } catch (err) {
    console.error(err);
    const code = String(err.message);
    setRgsReady(false);
    setMessage(isSessionFatal(code) ? messageForRgsCode(code) : rgsOfflineMessage());
    if (!isSessionFatal(code) && isConnectionFailure(code)) {
      notifyRgsConnectionLost(code);
    }
  }
}

export function attachBalanceRefresh(ctx) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || isReplayMode() || !ctx.rgsReady) {
      return;
    }

    if (ctx.isBusy?.()) {
      withRgsCall(() => authenticate())
        .then(async (data) => {
          ctx.applyAuthConfig?.(data);
          await ctx.lifecycle?.handleAuthRound(data.round, {
            lastEvent: data.meta?.lastEvent,
          });
          notifyRgsConnectionRestored();
        })
        .catch((err) => {
          console.warn('resume on visibility failed', err);
          const code = String(err?.message ?? '');
          if (isConnectionFailure(code)) {
            notifyRgsConnectionLost(code);
          }
        });
      return;
    }

    fetchBalance()
      .then((balanceObj) => {
        ctx.applyBalance(balanceObj);
        ctx.syncHud();
        notifyRgsConnectionRestored();
      })
      .catch((err) => {
        console.warn('balance refresh failed', err);
        const code = String(err?.message ?? '');
        if (isConnectionFailure(code)) {
          notifyRgsConnectionLost(code);
        }
      });
  });
}

export { createGameBootstrap } from './gameBootstrap.js';
export { createSessionTimer, formatSessionElapsed } from './sessionTimer.js';
export { createShellClock, formatShellClockTime } from './shellClock.js';
export { createGameAudio } from './gameAudio.js';
export { createGamePreloader } from './gamePreloader.js';
export { createAssetLoader, preloadAssets } from './assetLoader.js';
export {
  createCurrencyFormatter,
  formatCurrencyAmount,
  langToLocale,
  SOCIAL_CURRENCY_LABELS,
} from './currency.js';
export {
  createCopyPolicy,
  applyCopyLabels,
  isSocialCasinoMode,
  REAL_MONEY_COPY,
  SOCIAL_CASINO_COPY,
} from './copy.js';
export { setPlayerCurrency, getPlayerCurrency, clearPlayerCurrency } from './playerCurrency.js';
export { createI18n, resolveLang, SUPPORTED_LOCALES } from './i18n.js';
export {
  createBetModePolicy,
  normalizeModeKey,
  toRgsMode,
  parseGameModesFromIndex,
} from './betModes.js';
