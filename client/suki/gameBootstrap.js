import { initSuki, getDevComplianceLabel, getJurisdictionProfileName } from './config.js';
import { parseAuthResponse } from './authConfig.js';
import { createBetConfigPolicy, applyAuthRoundBetOverride } from './betConfig.js';
import { createControlPolicy } from './controlPolicy.js';
import { applyProductionShell } from './productionUi.js';
import { createJurisdictionController } from './jurisdiction.js';
import { createSukiLifecycle } from './lifecycle.js';
import { showDevTools, showComplianceFooter } from './environment.js';
import { getRgsConnectionInfo, getRgsParams } from '../rgs.js';
import { bootstrapPlayMode, attachBalanceRefresh } from './bootstrap.js';
import { createConnectionBanner } from './connectionBanner.js';
import { setRgsConnectionCallbacks } from './rgsConnection.js';
import { createSessionTimer } from './sessionTimer.js';
import { createCurrencyFormatter } from './currency.js';
import { createCopyPolicy, isSocialCasinoMode, applyCopyLabels } from './copy.js';
import { setPlayerCurrency, getPlayerCurrency } from './playerCurrency.js';
import { createBetModePolicy, applyBetModeFromRound } from './betModes.js';
import { isReplayMode } from './config.js';
import { initStakeScreenPreview } from './screenPreview.js';
import { initStakeLayout } from './stakeLayout.js';
import { applyMobileTouchPolicy } from './mobileTouch.js';
import { checkRgsGate, createFatalRgsError, isFatalRgsError } from './rgsGate.js';

/**
 * Single entry point — wires initSuki, production shell, jurisdiction, lifecycle, and RGS bootstrap.
 *
 * @param {object} options
 * @param {{ gameId: string, replayVersion?: string, sessionStorageKey?: string }} options.suki
 * @param {Parameters<typeof applyProductionShell>[0]} [options.shell]
 * @param {Omit<Parameters<typeof createSukiLifecycle>[0], 'jurisdiction'>} options.lifecycle
 * @param {{ defaultBetDisplay?: number, gameModes?: Array<{ name: string, cost?: number }>, defaultMode?: string, onConfigured?: (auth: object, data: object) => void }} [options.auth]
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

  applyMobileTouchPolicy();
  initSuki(suki);
  const shellResult = applyProductionShell(shell);

  const layoutRoot = shell.stakeLayout?.root ?? shell.screenPreview?.root ?? null;

  const screenPreview =
    showDevTools() && shell.screenPreview?.root
      ? initStakeScreenPreview({
          root: shell.screenPreview.root,
          extraScreens: shell.screenPreview.extraScreens,
          onScreenChange: shell.screenPreview.onScreenChange,
        })
      : null;

  const stakeLayout = layoutRoot
    ? initStakeLayout({
        root: layoutRoot,
        getActiveScreen: () => screenPreview?.getScreen() ?? null,
      })
    : null;

  let rgsReady = false;
  let rgsBlocked = false;
  /** @type {ReturnType<typeof createConnectionBanner> | null} */
  let connectionBanner = null;
  const elements = shell.elements ?? {};

  const initialParams = getRgsParams();
  setPlayerCurrency(initialParams.currency);
  let currency = createCurrencyFormatter({
    currency: initialParams.currency,
    language: initialParams.language,
  });
  let copy = createCopyPolicy();

  function refreshPlayerDisplay(authParsed) {
    const params = getRgsParams();
    const code = authParsed?.currency ?? getPlayerCurrency(params.currency);
    setPlayerCurrency(code);
    currency = createCurrencyFormatter({
      currency: code,
      language: params.language,
    });
    copy = createCopyPolicy({
      lang: params.language,
      socialCasino: isSocialCasinoMode(jurisdiction.state),
      overrides: auth.copyOverrides,
    });
    applyCopyLabels(copy, elements);
    connectionBanner?.refreshCopy();
  }

  const jurisdiction = createJurisdictionController(() => {
    refreshPlayerDisplay();
    syncDevTools();
    onJurisdictionChange?.();
  });

  const controls = createControlPolicy(jurisdiction);

  function replayModeFromUrl() {
    if (!isReplayMode()) return null;
    return new URLSearchParams(window.location.search).get('mode') || 'base';
  }

  let betModePolicy = createBetModePolicy({
    gameModes: auth.gameModes,
    controls,
    defaultMode: auth.defaultMode,
    replayMode: replayModeFromUrl(),
  });

  function refreshBetModes(parsed) {
    betModePolicy = createBetModePolicy({
      authBetModes: parsed?.betModes,
      gameModes: auth.gameModes,
      controls,
      defaultMode: auth.defaultMode,
      replayMode: replayModeFromUrl(),
    });
  }

  const sessionTimer =
    elements.sessionTimer || elements.sessionTimerContainer
      ? createSessionTimer({
          element: elements.sessionTimer ?? null,
          container: elements.sessionTimerContainer ?? null,
          controls,
          getVisible: () => !isReplayMode() && controls.showSessionTimer,
        })
      : null;

  refreshPlayerDisplay();

  let trackedBalanceApi = 0;
  /** @type {ReturnType<typeof createBetConfigPolicy> | null} */
  let betConfigPolicy = null;

  function applyBalance(balanceObj) {
    if (balanceObj?.amount != null && Number.isFinite(Number(balanceObj.amount))) {
      trackedBalanceApi = Number(balanceObj.amount);
    }
    lifecycleDeps.applyBalance(balanceObj);
  }

  function applyAuthConfig(data) {
    const parsed = parseAuthResponse(data, {
      defaultBetDisplay: auth.defaultBetDisplay,
      urlCurrency: getRgsParams().currency,
    });
    if (parsed.balance?.amount != null && Number.isFinite(Number(parsed.balance.amount))) {
      trackedBalanceApi = Number(parsed.balance.amount);
    }
    jurisdiction.mergeFromServer(parsed.jurisdiction);
    if (showDevTools()) {
      jurisdiction.applyDevProfile(getJurisdictionProfileName());
    }
    refreshPlayerDisplay(parsed);
    refreshBetModes(parsed);
    applyBetModeFromRound(data.round, betModePolicy);
    applyAuthRoundBetOverride(parsed, data.round, betModePolicy);
    betConfigPolicy = createBetConfigPolicy(parsed);
    if (showDevTools() && elements.autoplay) {
      controls.setVisible(elements.autoplay, controls.canAutoplay);
    }
    auth.onConfigured?.(parsed, data);
    sessionTimer?.sync();
  }

  function syncDevTools() {
    if (isReplayMode()) return;
    if (showDevTools()) {
      if (elements.testControls) {
        elements.testControls.hidden = false;
      }
      if (elements.autoplay) {
        controls.setVisible(elements.autoplay, controls.canAutoplay);
      }
      if (elements.newSession) {
        elements.newSession.hidden = false;
      }
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
    applyBalance,
    getBetModePolicy: () => betModePolicy,
    getBetConfigPolicy: () => betConfigPolicy,
    getBalanceApi: () => trackedBalanceApi,
  });

  function setRgsReady(ready) {
    rgsReady = ready;
    ui.onRgsReady?.(ready);
  }

  function getInvalidRgsMessage() {
    return copy.term('invalidRgsConnection');
  }

  function checkRgsGateForLaunch() {
    return checkRgsGate({
      invalidRgsMessage: getInvalidRgsMessage(),
    });
  }

  async function start() {
    if (isReplayMode()) {
      return replay?.start?.();
    }

    const gate = checkRgsGateForLaunch();
    if (!gate.ok) {
      rgsBlocked = true;
      setRgsReady(false);
      ui.setMessage(gate.message);
      throw createFatalRgsError(gate.message);
    }

    try {
      await bootstrapPlayMode({
        applyAuthConfig,
        lifecycle,
        setMessage: ui.setMessage,
        setRgsReady,
        onReady: ui.onReady,
        onAuthRound: ui.onAuthRound,
        connectingMessage: copy.term('connectingRgs'),
        readyMessage: copy.term('setBetPrompt'),
        invalidRgsMessage: getInvalidRgsMessage(),
      });
    } catch (err) {
      if (isFatalRgsError(err)) {
        rgsBlocked = true;
      }
      throw err;
    }
  }

  if (layoutRoot && !isReplayMode()) {
    connectionBanner = createConnectionBanner({
      root: layoutRoot,
      t: (key) => copy.t(key),
      onRetry: () => start(),
    });
  }

  setRgsConnectionCallbacks({
    onLost: () => {
      if (rgsBlocked) return;
      connectionBanner?.show();
    },
    onRestored: () => connectionBanner?.hide(),
  });

  attachBalanceRefresh({
    get rgsReady() {
      return rgsReady;
    },
    isBusy: ui.isBusy ?? (() => false),
    applyBalance,
    applyAuthConfig,
    lifecycle,
    syncHud: ui.syncHud ?? (() => {}),
  });

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
    get rgsBlocked() {
      return rgsBlocked;
    },
    setRgsReady,
    checkRgsGate: checkRgsGateForLaunch,
    sessionTimer,
    get copy() {
      return copy;
    },
    get i18n() {
      return copy.i18n;
    },
    t(key, vars) {
      return copy.t(key, vars);
    },
    get betModes() {
      return betModePolicy;
    },
    get betConfig() {
      return betConfigPolicy;
    },
    screenPreview,
    stakeLayout,
    get currency() {
      return currency;
    },
    formatCurrency(amount) {
      return currency.formatBalance(amount);
    },
    formatWin(amount) {
      return currency.formatWin(amount);
    },
    syncCopy() {
      refreshPlayerDisplay();
    },
    start,
    connectionBanner,
  };
}
