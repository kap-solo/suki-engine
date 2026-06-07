/**
 * Suki runtime environment — controls dev tooling, mock flags, and replay behaviour.
 *
 * production  — live Stake iframe (external rgs_url + sessionID required)
 * sandbox     — ?sandbox=true (real remote RGS; compliance footer, no mock flags)
 * development — ?dev=true (local mock RGS, test URLs, mock flags)
 * hostedDemo  — direct URL visit (e.g. Render demo); same-origin mock RGS, no dev UI
 * replay      — ?replay=true (recorded round, no live bet/event)
 */

import { isReplayMode, isDevMode, isSandboxMode } from './config.js';

/** @typedef {'production' | 'sandbox' | 'development' | 'hostedDemo' | 'replay'} SukiEnvironment */

/** Stake launch URL includes operator iframe params. */
export function isStakeLaunch() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get('rgs_url')?.trim() && params.get('sessionID')?.trim());
}

/** Public demo host (no Stake launch params) — play via same-origin mock RGS. */
export function isHostedDemoMode() {
  if (isReplayMode() || isDevMode() || isSandboxMode()) return false;
  return !isStakeLaunch();
}

/** @returns {SukiEnvironment} */
export function getEnvironment() {
  if (isReplayMode()) return 'replay';
  if (isSandboxMode()) return 'sandbox';
  if (isDevMode()) return 'development';
  if (isHostedDemoMode()) return 'hostedDemo';
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

export function isHostedDemoEnvironment() {
  return getEnvironment() === 'hostedDemo';
}

/** Local prototype — same machine, same-origin mock RGS (e.g. start.bat on localhost). */
export function isLocalMockRgsHost() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const rgsUrlRaw = params.get('rgs_url')?.trim();
  if (!rgsUrlRaw) return false;
  try {
    const page = new URL(window.location.href);
    const host = page.hostname;
    const isLocal =
      host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (!isLocal) return false;
    const rgs = new URL(rgsUrlRaw, page.href);
    return rgs.origin === page.origin;
  } catch {
    return false;
  }
}

/** Dev/test UI (100-play, compliance footer, mock jurisdiction) — off in production. */
export function showDevTools() {
  return isDevelopment() || isLocalMockRgsHost();
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
