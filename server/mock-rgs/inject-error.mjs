/**
 * Dev-only mock error injection via authenticate/play body `_mock`.
 * Ignored by production Stake RGS; used by harness and ?dev=true games.
 *
 * @example { _mock: { error: 'ERR_GLE' } }
 * @example { _mock: { play_error: 'ERR_UE' } }
 * @example { _mock: { err_is: true } } — authenticate → ERR_IS
 */

/** @typedef {'authenticate' | 'balance' | 'play' | 'end-round' | 'bet-event' | 'bet-action'} MockEndpoint */

/**
 * @param {object | undefined} body — RGS request body
 * @param {MockEndpoint} endpoint
 * @returns {string | null} ERR_* code to return, or null
 */
export function mockErrorCode(body, endpoint) {
  const mock = body?._mock;
  if (!mock) return null;

  if (endpoint === 'authenticate' && mock.err_is) {
    return 'ERR_IS';
  }

  const endpointKey = `${endpoint.replace(/-/g, '_')}_error`;
  if (typeof mock[endpointKey] === 'string') {
    return mock[endpointKey];
  }

  if (typeof mock.error === 'string') {
    return mock.error;
  }

  return null;
}

/**
 * @param {object | undefined} body
 * @param {MockEndpoint} endpoint
 * @param {(code: string, message: string) => object} errorFn
 * @returns {object | null}
 */
export function injectMockError(body, endpoint, errorFn) {
  const code = mockErrorCode(body, endpoint);
  if (!code) return null;
  return errorFn(code, `Mock ${code} on ${endpoint}`);
}
