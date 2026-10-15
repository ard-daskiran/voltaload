// Validation of the test start request: URL, method, RPS, duration and step rules.

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
} from "../config.js";

const ALLOWED_METHODS = ["GET", "POST"];

export interface StartRequest {
  url: string;
  method: string;
  body?: unknown;
  targetRps: number;
  duration: number;
  profile: LoadProfile;
}

export function validateStartRequest(input: any): { ok: true; value: StartRequest } | { ok: false; error: ApiError } {
  const { url: rawUrl, method = "GET", body, targetRps, duration, loadProfile = "CONSTANT", stepCount } = input ?? {};

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

  return {
    ok: true,
    value: {
      url,
      method,
      // A GET test sends no body, so don't save one either (so the detail page doesn't show it as "JSON Body")
      body: method === "GET" ? undefined : body,
      targetRps,
      duration,
      profile: loadProfile === "STEPPED" ? { type: "STEPPED", stepCount } : { type: "CONSTANT" },
    },
  };
}