/**
 * Suki runtime environment — controls dev tooling, mock flags, and replay behaviour.
 *
 * production  — live Stake iframe (external rgs_url + sessionID required)
 * sandbox     — ?sandbox=true (real remote RGS; compliance footer, no mock flags)
 * development — ?dev=true (local mock RGS, test URLs, mock flags)
 * replay      — ?replay=true (recorded round, no live bet/event)
 */

import { isReplayMode, isDevMode, isSandboxMode } from './config.js';

/** @typedef {'production' | 'sandbox' | 'development' | 'replay'} SukiEnvironment */

/** @returns {SukiEnvironment} */
export function getEnvironment() {
  if (isReplayMode()) return 'replay';
  if (isSandboxMode()) return 'sandbox';
  if (isDevMode()) return 'development';
  return 'production';
}

export function isSandboxEnvironment() {
  return getEnvironment() === 'sandbox';
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

/** Mock _mock flags on authenticate — only in local development (not sandbox). */
export function allowMockRgsFlags() {
  return isDevelopment();
}

/** Show compliance/dev footer — development and sandbox. */
export function showComplianceFooter() {
  return isDevelopment() || isSandboxEnvironment();
}

/** Live bet/event reporting — skipped in replay. */
export function shouldReportBetEvents() {
  return !isReplayEnvironment();
}
