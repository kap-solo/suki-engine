import { classifyRgsError } from './errors.js';

/** @type {(() => void) | null} */
let onLost = null;
/** @type {(() => void) | null} */
let onRestored = null;

/**
 * Wire connection banner (or other UI) to RGS transport failures.
 * @param {{ onLost?: () => void, onRestored?: () => void }} handlers
 */
export function setRgsConnectionCallbacks(handlers = {}) {
  onLost = handlers.onLost ?? null;
  onRestored = handlers.onRestored ?? null;
}

/** @param {string} code — RGS error code from thrown Error.message */
export function isConnectionFailure(code) {
  if (code === 'ERR_NET') return true;
  return classifyRgsError(code).retryable;
}

export function notifyRgsConnectionLost(code) {
  if (code && !isConnectionFailure(code)) return;
  onLost?.();
}

export function notifyRgsConnectionRestored() {
  onRestored?.();
}
