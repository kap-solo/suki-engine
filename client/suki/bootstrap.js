import { authenticate, fetchBalance, getRgsParams, isReplayMode } from '../rgs.js';
import { messageForRgsCode, isSessionFatal } from './errors.js';
import { getDevComplianceLabel } from './config.js';
import { rgsOfflineMessage } from './productionUi.js';
import { withRgsCall } from './rgsTransport.js';
import { validateRgsConfig } from './rgsConfig.js';
import { getEnvironment } from './environment.js';

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
  setMessage('Connecting to RGS…');

  try {
    const environment = getEnvironment();
    const validation = validateRgsConfig(getRgsParams(), environment);
    if (!validation.ok) {
      setRgsReady(false);
      setMessage(validation.issues.join(' · '));
      return;
    }

    const data = await withRgsCall(() => authenticate());
    applyAuthConfig(data);
    setRgsReady(true);

    const authOutcome = await lifecycle.handleAuthRound(data.round, {
      lastEvent: data.meta?.lastEvent,
    });

    ctx.onAuthRound?.(authOutcome);

    if (authOutcome.status === 'ready') {
      setMessage('Set bet · press Drop.');
    }
    onReady();
  } catch (err) {
    console.error(err);
    const code = String(err.message);
    setRgsReady(false);
    setMessage(isSessionFatal(code) ? messageForRgsCode(code) : rgsOfflineMessage());
  }
}

export function attachBalanceRefresh(ctx) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || isReplayMode() || !ctx.rgsReady || ctx.isBusy()) {
      return;
    }
    fetchBalance()
      .then((balanceObj) => {
        ctx.applyBalance(balanceObj);
        ctx.syncHud();
      })
      .catch((err) => console.warn('balance refresh failed', err));
  });
}

export { createGameBootstrap } from './gameBootstrap.js';
export { createSessionTimer, formatSessionElapsed } from './sessionTimer.js';
