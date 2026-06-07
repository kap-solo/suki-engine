import { isProduction, isReplayEnvironment } from './environment.js';

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
  const strip = isProduction() || isReplayEnvironment();

  if (!strip) {
    return { stripped: false, environment: isReplayEnvironment() ? 'replay' : 'development' };
  }

  const nodes = [
    elements.complianceDev,
    elements.testControls,
    elements.copyReplay,
    elements.newSession,
    elements.autoplay,
    elements.devAside,
    ...extra,
  ];

  if (hidePrinciples && elements.devAside) {
    nodes.push(elements.devAside);
  }

  for (const el of nodes) {
    if (el) el.hidden = true;
  }

  document.querySelectorAll('[data-suki-dev]').forEach((el) => {
    el.hidden = true;
  });

  return { stripped: true, environment: isReplayEnvironment() ? 'replay' : 'production' };
}

/** Player-facing message when RGS is unreachable. */
export function rgsOfflineMessage() {
  return isProduction()
    ? 'Game temporarily unavailable — try again shortly.'
    : 'RGS unavailable — run: node server.mjs';
}
