// Small conversions for the test record.

import type { LoadProfile } from "../engine/scheduler.js";

// BigInt can't be converted to JSON, convert it to a number
export function serializeRun<T extends { totalBytes: bigint | null }>(run: T) {
  return { ...run, totalBytes: run.totalBytes !== null ? Number(run.totalBytes) : null };
}

// Convert the stored test type to the shape the scheduler understands
export function profileOf(run: { loadProfile: string; stepCount: number | null }): LoadProfile {
  return run.loadProfile === "STEPPED"
    ? { type: "STEPPED", stepCount: run.stepCount ?? 1 }
    : { type: "CONSTANT" };
}