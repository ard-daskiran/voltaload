// Validation of the test start request: URL, method, RPS, duration, step rules and custom headers.

import type { LoadProfile } from "../engine/scheduler.js";
import { apiError, type ApiError } from "../errors.js";
import {
  MIN_TARGET_RPS,
  MAX_TARGET_RPS,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
  MIN_STEP_COUNT,
  MAX_STEP_COUNT,
  MIN_STEP_DURATION_SECONDS,
  MAX_URL_LENGTH,
  MAX_HEADERS,
  MAX_HEADER_BYTES,
  MAX_BODY_KB,
} from "../config.js";

const ALLOWED_METHODS = ["GET", "POST"];

// A custom header. masked: shown as "••••" on the detail page and in the report (the real value is still sent and saved).
export interface RequestHeader {
  name: string;
  value: string;
  masked: boolean;
}

export interface StartRequest {
  url: string;
  method: string;
  body?: unknown;
  headers: RequestHeader[];
  targetRps: number;
  duration: number;
  profile: LoadProfile;
}

// Managed by Volta and undici. undici refuses to send a request that sets them,
// so every request in the test would fail as a "network error".
const FORBIDDEN_HEADERS = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
  "expect",
]);

// Header name: English letters, digits and a few symbols (the characters HTTP allows). No spaces.
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
// Header value: printable English characters, spaces and tabs. No line breaks (they would let a value add
// extra headers) and no letters like "ş" or "ğ" (HTTP headers don't support them; undici would throw).
const HEADER_VALUE_PATTERN = /^[\t\x20-\x7e]*$/;

type HeadersResult = { ok: true; value: RequestHeader[] } | { ok: false; error: ApiError };

function validateHeaders(input: unknown): HeadersResult {
  // No headers sent: an empty list (older clients, curl)
  if (input === undefined || input === null) return { ok: true, value: [] };
  if (!Array.isArray(input)) return { ok: false, error: apiError("INVALID_HEADERS") };
  if (input.length > MAX_HEADERS) {
    return { ok: false, error: apiError("TOO_MANY_HEADERS", { max: MAX_HEADERS }) };
  }

  const headers: RequestHeader[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  for (const item of input) {
    if (typeof item !== "object" || item === null || typeof item.name !== "string" || typeof item.value !== "string") {
      return { ok: false, error: apiError("INVALID_HEADERS") };
    }

    // Spaces around the name and value are removed (HTTP ignores them too)
    const name = item.name.trim();
    const value = item.value.trim();
    // Names are case-insensitive: "authorization" and "Authorization" are the same header
    const key = name.toLowerCase();

    if (!HEADER_NAME_PATTERN.test(name)) {
      return { ok: false, error: apiError("HEADER_NAME_INVALID", { name: name.slice(0, 100) }) };
    }
    if (FORBIDDEN_HEADERS.has(key)) {
      return { ok: false, error: apiError("HEADER_FORBIDDEN", { name }) };
    }
    if (seen.has(key)) {
      return { ok: false, error: apiError("HEADER_DUPLICATE", { name }) };
    }
    if (!HEADER_VALUE_PATTERN.test(value)) {
      return { ok: false, error: apiError("HEADER_VALUE_INVALID", { name }) };
    }

    seen.add(key);
    // Size as it goes over the network: "name: value\r\n" (names and values are plain English characters, 1 byte each)
    totalBytes += name.length + value.length + 4;
    headers.push({ name, value, masked: item.masked === true });
  }

  if (totalBytes > MAX_HEADER_BYTES) {
    return { ok: false, error: apiError("HEADERS_TOO_LARGE", { max: MAX_HEADER_BYTES }) };
  }

  return { ok: true, value: headers };
}

export function validateStartRequest(input: any): { ok: true; value: StartRequest } | { ok: false; error: ApiError } {
  const {
    url: rawUrl,
    method = "GET",
    body,
    headers: rawHeaders,
    targetRps,
    duration,
    loadProfile = "CONSTANT",
    stepCount,
  } = input ?? {};

  // Leading and trailing whitespace is removed (otherwise it won't match its name in the target book). Same length limit as the target book.
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (url.length === 0 || url.length > MAX_URL_LENGTH) {
    return { ok: false, error: apiError("INVALID_URL") };
  }

  if (!ALLOWED_METHODS.includes(method)) {
    return { ok: false, error: apiError("INVALID_METHOD") };
  }

  if (typeof targetRps !== "number" || !Number.isInteger(targetRps) || targetRps < MIN_TARGET_RPS || targetRps > MAX_TARGET_RPS) {
    return { ok: false, error: apiError("INVALID_RPS", { min: MIN_TARGET_RPS, max: MAX_TARGET_RPS }) };
  }

  if (typeof duration !== "number" || !Number.isInteger(duration) || duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS) {
    return { ok: false, error: apiError("INVALID_DURATION", { min: MIN_DURATION_SECONDS, max: MAX_DURATION_SECONDS }) };
  }

  if (loadProfile !== "CONSTANT" && loadProfile !== "STEPPED") {
    return { ok: false, error: apiError("INVALID_PROFILE") };
  }

  if (loadProfile === "STEPPED") {
    if (typeof stepCount !== "number" || !Number.isInteger(stepCount) || stepCount < MIN_STEP_COUNT || stepCount > MAX_STEP_COUNT) {
      return { ok: false, error: apiError("INVALID_STEP_COUNT", { min: MIN_STEP_COUNT, max: MAX_STEP_COUNT }) };
    }
    // Each step must send at least 1 request per second (so rounding never gives a 0 RPS step)
    if (targetRps < stepCount) {
      return { ok: false, error: apiError("STEP_RPS_TOO_LOW", { min: stepCount }) };
    }
    if (duration / stepCount < MIN_STEP_DURATION_SECONDS) {
      return { ok: false, error: apiError("STEP_TOO_SHORT", { min: MIN_STEP_DURATION_SECONDS }) };
    }
  }

  // The body's own limit. (The request as a whole may be a bit larger, to leave room for the headers: server.ts)
  if (method !== "GET" && body !== undefined && Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_KB * 1024) {
    return { ok: false, error: apiError("BODY_TOO_LARGE", { max: `${MAX_BODY_KB} KB` }) };
  }

  const headers = validateHeaders(rawHeaders);
  if (!headers.ok) return headers;

  return {
    ok: true,
    value: {
      url,
      method,
      // A GET test sends no body, so don't save one either (so the detail page doesn't show it as "JSON Body")
      body: method === "GET" ? undefined : body,
      // Headers are sent with GET too (unlike the body): tokens are usually needed for GET requests
      headers: headers.value,
      targetRps,
      duration,
      profile: loadProfile === "STEPPED" ? { type: "STEPPED", stepCount } : { type: "CONSTANT" },
    },
  };
}