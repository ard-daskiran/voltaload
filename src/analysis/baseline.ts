// Baseline: the server's p95 when it's at ease. Latency increase is measured against it.
// It's only valid if the first seconds really were healthy.
// Otherwise (if the server was strained from the start) only the fixed limits, error and RPS rules apply.

import { THRESHOLDS as T } from "./thresholds.js";
import { median, type SecondStats } from "./seconds.js";
import { percentileOf } from "../engine/windowStats.js";
import { aggregate } from "./classify.js";

export interface Baseline {
  valid: boolean;
  measured: boolean; // Were there measurable seconds for the baseline (if not, the server couldn't be reached from the start)
  p95: number | null;
}

// limitIndex: look before this second (in a stepped test, the end of the first step)
export function findBaseline(seconds: SecondStats[], limitIndex: number): Baseline {
  // Seconds with connection errors are skipped: in those seconds the server isn't slow, it's not there at all.
  // (If the server shuts down in the first seconds, don't say "strained from the start"; the disconnect is reported by its own event.)
  const inRange = seconds.filter(
    (s) =>
      s.index < limitIndex && s.latencies.length > 0 && s.connectionErrors / s.total < T.connectionErrorRate
  );

  // The warm-up second is skipped. If the first step is very short (e.g. 2.5 s) only one second may remain;
  // then that single second is used. If none remain, the warm-up second is used too.
  let candidates = inRange.filter((s) => s.index >= T.warmupSeconds).slice(0, T.baselineSeconds);
  if (candidates.length === 0) candidates = inRange.slice(0, T.baselineSeconds);
  if (candidates.length === 0) return { valid: false, measured: false, p95: null };

  const p95 = median(candidates.map((s) => percentileOf(s.latencies, 0.95)!))!;
  const stats = aggregate(candidates);

  const healthy =
    stats.errorRate < T.errorRate.borderline &&
    stats.connectionErrorRate < T.connectionErrorRate &&
    stats.throughputRatio >= T.throughput.borderline &&
    p95 < T.absolute.borderlineMs;

  return { valid: healthy, measured: true, p95: Math.round(p95) };
}