import { classifyRgsError } from './errors.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call an RGS function with retry for retryable errors (ERR_UE, ERR_GE, ERR_GEN).
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number, delayMs?: number }} [options]
 * @returns {Promise<T>}
 */
export async function withRgsCall(fn, { maxAttempts = 2, delayMs = 400 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const policy = classifyRgsError(String(err.message));
      if (!policy.retryable || attempt >= maxAttempts) {
        throw err;
      }
      await sleep(delayMs * attempt);
    }
  }
  throw lastError;
}
