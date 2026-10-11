// Test kaydıyla ilgili küçük çeviriler.

import type { LoadProfile } from "../engine/scheduler.js";

// BigInt JSON'a çevrilemez, sayıya çevir
export function serializeRun<T extends { totalBytes: bigint | null }>(run: T) {
  return { ...run, totalBytes: run.totalBytes !== null ? Number(run.totalBytes) : null };
}

// Kayıttaki test türünü zamanlayıcının anladığı biçime çevir
export function profileOf(run: { loadProfile: string; stepCount: number | null }): LoadProfile {
  return run.loadProfile === "STEPPED"
    ? { type: "STEPPED", stepCount: run.stepCount ?? 1 }
    : { type: "CONSTANT" };
}