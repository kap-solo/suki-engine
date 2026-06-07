/**
 * Suki runtime environment — controls dev tooling, mock flags, and replay behaviour.
 *
 * production  — live Stake iframe (no dev UI, no mock flags)
 * development — ?dev=true (compliance footer, test URLs, mock RGS flags)
 * replay      — ?replay=true (recorded round, no live bet/event)
 */

import { isReplayMode, isDevMode } from './config.js';

/** @typedef {'production' | 'development' | 'replay'} SukiEnvironment */

/** @returns {SukiEnvironment} */
export function getEnvironment() {
  if (isReplayMode()) return 'replay';
  if (isDevMode()) return 'development';
  return 'production';
}

export function isProduction() {
  return getEnvironment() === 'production';
}

export function isDevelopment() {
  return getEnvironment() === 'development';
}

export function isReplayEnvironment() {
  return getEnvironment() === 'replay';
}

/** Dev/test UI (100-play, compliance footer, mock jurisdiction) — off in production. */
export function showDevTools() {
  return isDevelopment();
}

/** Mock _mock flags on authenticate — only in development. */
export function allowMockRgsFlags() {
  return isDevelopment();
}

/** Live bet/event reporting — skipped in replay. */
export function shouldReportBetEvents() {
  return !isReplayEnvironment();
}
