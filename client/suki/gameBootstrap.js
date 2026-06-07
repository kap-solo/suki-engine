import { initSuki, getDevComplianceLabel, getJurisdictionProfileName } from './config.js';
import { parseAuthResponse } from './authConfig.js';
import { createControlPolicy } from './controlPolicy.js';
import { applyProductionShell } from './productionUi.js';
import { createJurisdictionController } from './jurisdiction.js';
import { createSukiLifecycle } from './lifecycle.js';
import { showDevTools, showComplianceFooter } from './environment.js';
import { getRgsConnectionInfo, isReplayMode } from '../rgs.js';
import { bootstrapPlayMode, attachBalanceRefresh } from './bootstrap.js';
import { createSessionTimer } from './sessionTimer.js';

/**
 * Single entry point — wires initSuki, production shell, jurisdiction, lifecycle, and RGS bootstrap.
 *
 * @param {object} options
 * @param {{ gameId: string, replayVersion?: string, sessionStorageKey?: string }} options.suki
 * @param {Parameters<typeof applyProductionShell>[0]} [options.shell]
 * @param {Omit<Parameters<typeof createSukiLifecycle>[0], 'jurisdiction'>} options.lifecycle
 * @param {{ defaultBetDisplay?: number, onConfigured?: (auth: object, data: object) => void }} [options.auth]
 * @param {object} options.ui
 * @param {(text: string) => void} options.ui.setMessage
 * @param {() => void} [options.ui.syncHud]
 * @param {() => boolean} [options.ui.isBusy]
 * @param {(ready: boolean) => void} [options.ui.onRgsReady]
 * @param {() => void} [options.ui.onReady]
 * @param {(outcome: object) => void} [options.ui.onAuthRound]
 * @param {() => void} [options.ui.onSyncDevTools]
 * @param {() => void} [options.onJurisdictionChange]
 * @param {{ start: () => void | Promise<void> }} [options.replay]
 */
export function createGameBootstrap(options) {
  const { suki, shell = {}, lifecycle: lifecycleDeps, auth = {}, ui, onJurisdictionChange, replay } = options;

  initSuki(suki);
  const shellResult = applyProductionShell(shell);

  let rgsReady = false;

  const jurisdiction = createJurisdictionController(() => {
    syncDevTools();
    onJurisdictionChange?.();
  });

  const controls = createControlPolicy(jurisdiction);
  const elements = shell.elements ?? {};

  function applyAuthConfig(data) {
    const parsed = parseAuthResponse(data, { defaultBetDisplay: auth.defaultBetDisplay });
    jurisdiction.mergeFromServer(parsed.jurisdiction);
    if (showDevTools()) {
      jurisdiction.applyDevProfile(getJurisdictionProfileName());
    }
    if (elements.autoplay) {
      controls.setVisible(elements.autoplay, controls.canAutoplay);
    }
    auth.onConfigured?.(parsed, data);
    sessionTimer?.sync();
  }

  function syncDevTools() {
    if (isReplayMode()) return;
    if (elements.autoplay) {
      controls.setVisible(elements.autoplay, controls.canAutoplay);
    }
    if (elements.newSession) {
      elements.newSession.hidden = false;
    }
    if (elements.complianceDev) {
      const show = showComplianceFooter();
      elements.complianceDev.hidden = !show;
      if (show) {
        const conn = getRgsConnectionInfo();
        elements.complianceDev.textContent = `${conn.modeLabel} · ${conn.rgsUrl} · ${getDevComplianceLabel()}`;
      }
    }
    sessionTimer?.sync();
    ui.onSyncDevTools?.();
  }

  const lifecycle = createSukiLifecycle({
    jurisdiction,
    ...lifecycleDeps,
  });

  function setRgsReady(ready) {
    rgsReady = ready;
    ui.onRgsReady?.(ready);
  }

  attachBalanceRefresh({
    get rgsReady() {
      return rgsReady;
    },
    isBusy: ui.isBusy ?? (() => false),
    applyBalance: lifecycleDeps.applyBalance,
    syncHud: ui.syncHud ?? (() => {}),
  });

  function start() {
    if (isReplayMode()) {
      return replay?.start?.();
    }
    return bootstrapPlayMode({
      applyAuthConfig,
      lifecycle,
      setMessage: ui.setMessage,
      setRgsReady,
      onReady: ui.onReady,
      onAuthRound: ui.onAuthRound,
    });
  }

  return {
    jurisdiction,
    controls,
    lifecycle,
    shell: shellResult,
    applyAuthConfig,
    syncDevTools,
    get rgsReady() {
      return rgsReady;
    },
    setRgsReady,
    sessionTimer,
    start,
  };
}
