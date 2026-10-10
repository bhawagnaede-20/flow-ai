/**
 * FLOW AI — reusable API client for the Flask backend.
 *
 * - Single fetch wrapper used by every helper in ./endpoints.js.
 * - Base URL comes from VITE_API_BASE_URL. Local development defaults to localhost;
 *   production fails clearly when the deployment URL has not been configured.
 * - Every failure is thrown as a typed ApiError so callers can distinguish
 *   network failures, timeouts, HTTP errors and malformed payloads.
 *
 * This client NEVER reports a failure as a success: if the request did not
 * return a valid `{ ok: true, data }` envelope, an ApiError is thrown.
 */

const DEFAULT_BASE_URL = 'http://localhost:5000';

/** Resolved backend origin without a trailing slash. */
export function getApiBaseUrl() {
  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_API_BASE_URL
      : undefined;
  // Do not silently ship a production build that calls each visitor's localhost.
  const isProductionBuild =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD === true;
  const base =
    typeof fromEnv === 'string' && fromEnv.trim() !== ''
      ? fromEnv.trim()
      : isProductionBuild
        ? ''
        : DEFAULT_BASE_URL;
  return base.replace(/\/+$/, '');
}

/** Failure categories so UI code can react appropriately. */
export const ERROR_KINDS = {
  NETWORK: 'network', // fetch rejected (offline, DNS, refused connection, CORS)
  TIMEOUT: 'timeout', // request exceeded the timeout budget
  HTTP: 'http', // non-2xx HTTP status
  INVALID_JSON: 'invalid-json', // body was not parseable JSON
  INVALID_RESPONSE: 'invalid-response', // 2xx but payload does not match the envelope/contract
  SERVER: 'server', // 2xx but the envelope said ok:false
  CONFIGURATION: 'configuration', // production API URL is not configured
};

export class ApiError extends Error {
  constructor(message, { kind, status = null, code = null, endpoint = null, cause = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.endpoint = endpoint;
    this.cause = cause;
  }

  get isNetworkError() {
    return this.kind === ERROR_KINDS.NETWORK || this.kind === ERROR_KINDS.TIMEOUT;
  }
}

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Perform a JSON request against the backend.
 *
 * @param {string} path      path beginning with "/api/…"
 * @param {object} [options]
 * @param {string} [options.method]   GET | POST | PATCH | DELETE
 * @param {*}      [options.body]     JSON-serialised request body (omit for none)
 * @param {number} [options.timeoutMs]
 * @returns {Promise<any>} the `data` field of the response envelope
 * @throws {ApiError} on network/timeout/HTTP/shape failures
 */
export async function apiRequest(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const baseUrl = getApiBaseUrl();
  const endpoint = `${method} ${path}`;
  if (!baseUrl) {
    throw new ApiError(
      'FLOW AI backend URL is not configured. Set VITE_API_BASE_URL in your Netlify site environment variables, then redeploy.',
      { kind: ERROR_KINDS.CONFIGURATION, endpoint },
    );
  }
  const url = `${baseUrl}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = { Accept: 'application/json' };
  const init = { method, headers, signal: controller.signal };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    const timedOut = cause && cause.name === 'AbortError';
    throw new ApiError(
      timedOut
        ? `Request timed out after ${timeoutMs} ms (${endpoint})`
        : `Network error reaching the backend at ${getApiBaseUrl()} (${endpoint})`,
      { kind: timedOut ? ERROR_KINDS.TIMEOUT : ERROR_KINDS.NETWORK, endpoint, cause },
    );
  } finally {
    clearTimeout(timer);
  }

  // Parse the body once; error payloads use the same envelope.
  let payload = null;
  let rawText = null;
  try {
    rawText = await response.text();
    payload = rawText === '' ? null : JSON.parse(rawText);
  } catch (cause) {
    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status} from ${endpoint} (non-JSON body)`, {
        kind: ERROR_KINDS.HTTP,
        status: response.status,
        endpoint,
        cause,
      });
    }
    throw new ApiError(`Invalid JSON received from ${endpoint}`, {
      kind: ERROR_KINDS.INVALID_JSON,
      status: response.status,
      endpoint,
      cause,
    });
  }

  const envelopeOk =
    payload !== null && typeof payload === 'object' && !Array.isArray(payload) && 'ok' in payload;

  if (envelopeOk && payload.ok !== true) {
    // Backend answered, but with a failure envelope (400/404/409/… or ok:false).
    const err = payload.error ?? {};
    const kind = response.ok ? ERROR_KINDS.SERVER : ERROR_KINDS.HTTP;
    throw new ApiError(err.message || `Backend reported a failure for ${endpoint}`, {
      kind,
      status: response.status,
      code: typeof err.code === 'string' ? err.code : null,
      endpoint,
    });
  }

  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status} from ${endpoint}`, {
      kind: ERROR_KINDS.HTTP,
      status: response.status,
      endpoint,
    });
  }

  if (!envelopeOk) {
    throw new ApiError(`Unexpected response shape from ${endpoint} (missing { ok, data } envelope)`, {
      kind: ERROR_KINDS.INVALID_RESPONSE,
      status: response.status,
      endpoint,
    });
  }

  if (!('data' in payload)) {
    throw new ApiError(`Response from ${endpoint} is missing the "data" field`, {
      kind: ERROR_KINDS.INVALID_RESPONSE,
      status: response.status,
      endpoint,
    });
  }

  return payload.data;
}

/**
 * Validate the top-level shape of an unwrapped `data` payload.
 * Throws ApiError(invalid-response) when a required key is missing or mistyped.
 *
 * @param {any} data
 * @param {string} endpoint    label used in the error message
 * @param {Record<string, 'object'|'array'|'string'|'number'|'boolean'>} shape
 */
export function expectPayload(data, endpoint, shape) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError(`Invalid response from ${endpoint}: expected an object payload`, {
      kind: ERROR_KINDS.INVALID_RESPONSE,
      endpoint,
    });
  }
  for (const [key, type] of Object.entries(shape)) {
    const value = data[key];
    const ok = type === 'array' ? Array.isArray(value) : typeof value === type;
    if (!ok || value === null) {
      throw new ApiError(
        `Invalid response from ${endpoint}: field "${key}" should be ${type}`,
        { kind: ERROR_KINDS.INVALID_RESPONSE, endpoint },
      );
    }
  }
  return data;
}
