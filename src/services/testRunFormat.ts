// Small conversions for the test record.

import type { LoadProfile } from "../engine/scheduler.js";
import type { RequestHeader } from "./startRequest.js";

// BigInt can't be converted to JSON, convert it to a number.
// Headers are left out: the history list doesn't need them, and they may contain tokens.
// The detail page adds them back as a list (parseHeaders).
export function serializeRun<T extends { totalBytes: bigint | null; headers: string | null }>(run: T) {
  const { headers, ...rest } = run;
  void headers;
  return { ...rest, totalBytes: run.totalBytes !== null ? Number(run.totalBytes) : null };
}

// Saved headers (JSON text) → list. Empty for tests without headers, tests made before headers were added
// and unreadable values (so the detail page, the report and "Run again" never break on an old test).
export function parseHeaders(stored: string | null): RequestHeader[] {
  if (!stored) return [];
  try {
    const list = JSON.parse(stored);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Convert the stored test type to the shape the scheduler understands
export function profileOf(run: { loadProfile: string; stepCount: number | null }): LoadProfile {
  return run.loadProfile === "STEPPED"
    ? { type: "STEPPED", stepCount: run.stepCount ?? 1 }
    : { type: "CONSTANT" };
}