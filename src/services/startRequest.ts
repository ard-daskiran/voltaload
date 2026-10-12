// Test başlatma isteğinin doğrulanması: URL, yöntem, RPS, süre ve kademe kuralları.

import type { LoadProfile } from "../engine/scheduler.js";
import { apiError, type ApiError } from "../errors.js";
import {
  MAX_TARGET_RPS,
  MAX_DURATION_SECONDS,
  MIN_STEP_COUNT,
  MAX_STEP_COUNT,
  MIN_STEP_DURATION_SECONDS,
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
  const { url, method = "GET", body, targetRps, duration, loadProfile = "CONSTANT", stepCount } = input ?? {};

  if (typeof url !== "string" || url.length === 0) {
    return { ok: false, error: apiError("INVALID_URL") };
  }

  if (!ALLOWED_METHODS.includes(method)) {
    return { ok: false, error: apiError("INVALID_METHOD") };
  }

  if (typeof targetRps !== "number" || !Number.isInteger(targetRps) || targetRps < 1 || targetRps > MAX_TARGET_RPS) {
    return { ok: false, error: apiError("INVALID_RPS", { max: MAX_TARGET_RPS }) };
  }

  if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 1 || duration > MAX_DURATION_SECONDS) {
    return { ok: false, error: apiError("INVALID_DURATION", { max: MAX_DURATION_SECONDS }) };
  }

  if (loadProfile !== "CONSTANT" && loadProfile !== "STEPPED") {
    return { ok: false, error: apiError("INVALID_PROFILE") };
  }

  if (loadProfile === "STEPPED") {
    if (typeof stepCount !== "number" || !Number.isInteger(stepCount) || stepCount < MIN_STEP_COUNT || stepCount > MAX_STEP_COUNT) {
      return { ok: false, error: apiError("INVALID_STEP_COUNT", { min: MIN_STEP_COUNT, max: MAX_STEP_COUNT }) };
    }
    // Her kademe saniyede en az 1 istek göndermeli (yuvarlanınca 0 RPS'lik kademe olmasın)
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
      body,
      targetRps,
      duration,
      profile: loadProfile === "STEPPED" ? { type: "STEPPED", stepCount } : { type: "CONSTANT" },
    },
  };
}