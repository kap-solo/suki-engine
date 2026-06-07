import {
  isProduction,
  isReplayEnvironment,
  isSandboxEnvironment,
  isHostedDemoEnvironment,
  showDevTools,
} from './environment.js';

/**
 * Hide dev-only UI in production and replay. Call once at game startup.
 *
 * @param {object} [options]
 * @param {Record<string, HTMLElement | null>} [options.elements] — named dev elements
 * @param {(HTMLElement | null)[]} [options.extra] — additional nodes to hide
 * @param {boolean} [options.hidePrinciples=true] — hide design/dev copy blocks
 */
export function applyProductionShell(options = {}) {
  const { elements = {}, extra = [], hidePrinciples = true } = options;
  const env = isReplayEnvironment()
    ? 'replay'
    : isSandboxEnvironment()
      ? 'sandbox'
      : isHostedDemoEnvironment()
        ? 'hostedDemo'
        : isProduction()
          ? 'production'
          : 'development';
  const stripTestControls = !showDevTools() || isReplayEnvironment();
  const stripComplianceDev = isProduction() || isHostedDemoEnvironment() || isReplayEnvironment();

  if (!stripTestControls && !stripComplianceDev) {
    return { stripped: false, environment: env };
  }

  const testNodes = [
    elements.testControls,
    elements.copyReplay,
    elements.newSession,
    elements.autoplay,
    elements.devAside,
    ...extra,
  ];

  if (stripTestControls) {
    for (const el of testNodes) {
      if (el) el.hidden = true;
    }
    document.querySelectorAll('[data-suki-dev]').forEach((el) => {
      if (el.id !== 'compliance-dev') el.hidden = true;
    });
  }

  if (stripComplianceDev && elements.complianceDev) {
    elements.complianceDev.hidden = true;
  }

  return { stripped: true, environment: env };
}

/** Player-facing message when RGS is unreachable. */
export function rgsOfflineMessage() {
  if (isProduction() || isSandboxEnvironment()) {
    return 'Game temporarily unavailable — try again shortly.';
  }
  return 'RGS unavailable — run: node server.mjs';
}
