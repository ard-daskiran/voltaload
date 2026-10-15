// State of a group of seconds (a step or the whole constant test):
// healthy / borderline / strained / collapsed. The worst of five measures decides:
// error rate, connection errors, successful/target ratio, latency, rising trend.

import { THRESHOLDS as T } from "./thresholds.js";
import { median, type SecondStats } from "./seconds.js";  
import { percentileOf } from "../engine/windowStats.js";
import type { Baseline } from "./baseline.js";

export type HealthState = "HEALTHY" | "BORDERLINE" | "STRAINED" | "COLLAPSED";

// Why the state is what it is (the UI can show these as explanations)
export type Reason =
  | "errors"
  | "connectionErrors"
  | "noResponses"
  | "throughput"
  | "latencyRelative"
  | "latencyAbsolute"
  | "rising";

const RANK: Record<HealthState, number> = { HEALTHY: 0, BORDERLINE: 1, STRAINED: 2, COLLAPSED: 3 };

function worst(a: HealthState, b: HealthState): HealthState {
  return RANK[a] >= RANK[b] ? a : b;
}

export interface GroupStats {
  expected: number; // Total target requests
  total: number;
  success: number;
  serverErrors: number;
  connectionErrors: number;
  timeouts: number;
  statusCounts: Record<string, number>;
  latencies: number[];
  avg: number | null;
  p95: number | null;
  p99: number | null;
  errorRate: number;
  connectionErrorRate: number;
  throughputRatio: number;
  actualRps: number;
  targetRps: number;
}

// Merges seconds. p95/p99 are recomputed from all latencies (not the mean of per-second p95s).
export function aggregate(seconds: SecondStats[]): GroupStats {
  const statusCounts: Record<string, number> = {};
  const latencies: number[] = [];
  let expected = 0, total = 0, success = 0, serverErrors = 0, connectionErrors = 0, timeouts = 0;
  // Only successes in seconds that have a target (since results are placed in the second they were sent,
  // seconds without a target don't occur; this is a safeguard).
  let successInTarget = 0;

  for (const s of seconds) {
    expected += s.targetRps;
    total += s.total;
    success += s.success;
    if (s.targetRps > 0) successInTarget += s.success;
    serverErrors += s.serverErrors;
    connectionErrors += s.connectionErrors;
    timeouts += s.timeouts;
    for (const [code, count] of Object.entries(s.statusCounts)) {
      statusCounts[code] = (statusCounts[code] || 0) + count;
    }
    for (const latency of s.latencies) latencies.push(latency);
  }

  latencies.sort((a, b) => a - b);

  // Per-second values (achieved RPS, average target) are divided by the DURATION of the seconds that have a target.
  // The last second of a stopped test can be partial (180 requests in 0.6 s = 300 RPS, not 180).
  const targetSpan = seconds.filter((s) => s.targetRps > 0).reduce((sum, s) => sum + s.span, 0);
  const n = targetSpan > 0 ? targetSpan : Math.max(1, seconds.length);

  return {
    expected,
    total,
    success,
    serverErrors,
    connectionErrors,
    timeouts,
    statusCounts,
    latencies,
    avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
    p95: percentileOf(latencies, 0.95),
    p99: percentileOf(latencies, 0.99),
    errorRate: total > 0 ? serverErrors / total : 0,
    connectionErrorRate: total > 0 ? connectionErrors / total : 0,
    throughputRatio: expected > 0 ? successInTarget / expected : 1,
    actualRps: successInTarget / n,
    targetRps: expected / n,
  };
}

// Latency limits relative to the baseline ("N times or +X ms, whichever is larger")
export function latencyLimits(baseline: Baseline): { borderline: number; strained: number } | null {
  if (!baseline.valid || baseline.p95 === null) return null;
  const b = baseline.p95;
  const r = T.relative;
  return {
    borderline: Math.max(b * r.borderlineRatio, b + r.borderlineMinExtraMs),
    strained: Math.max(b * r.strainedRatio, b + r.strainedMinExtraMs),
  };
}

// Is latency steadily rising under the same load? (median p95 of the first seconds vs. the last seconds)
function detectTrend(seconds: SecondStats[]): { from: number; to: number } | null {
  const p95s = seconds.map((s) => percentileOf(s.latencies, 0.95)).filter((v): v is number => v !== null);
  if (p95s.length < T.trend.minSeconds) return null;

  const k = Math.min(3, Math.floor(p95s.length / 2));
  const from = median(p95s.slice(0, k))!;
  const to = median(p95s.slice(-k))!;

  if (to >= from * T.trend.ratio && to - from >= T.trend.minExtraMs) {
    return { from: Math.round(from), to: Math.round(to) };
  }
  return null;
}

export interface Classification {
  stats: GroupStats;
  state: HealthState;
  reasons: Reason[];
  trend: { from: number; to: number } | null;
}

export function classifyGroup(seconds: SecondStats[], baseline: Baseline): Classification {
  const stats = aggregate(seconds);
  const reasons: Reason[] = [];
  let state: HealthState = "HEALTHY";

  const raise = (to: HealthState, reason: Reason) => {
    if (RANK[to] > RANK.HEALTHY && !reasons.includes(reason)) reasons.push(reason);
    state = worst(state, to);
  };

  // There was a target but no responses arrived at all
  if (stats.total === 0) {
    if (stats.expected > 0) raise("COLLAPSED", "noResponses");
    return { stats, state, reasons, trend: null };
  }

  // 1. Error rate
  const e = T.errorRate;
  if (stats.errorRate >= e.collapsed) raise("COLLAPSED", "errors");
  else if (stats.errorRate >= e.strained) raise("STRAINED", "errors");
  else if (stats.errorRate >= e.borderline) raise("BORDERLINE", "errors");

  // 2. Connection errors (the server shut down or dropped the connection)
  if (stats.connectionErrorRate >= T.connectionErrorRate) raise("COLLAPSED", "connectionErrors");

  // 3. Successful requests / target
  const tp = T.throughput;
  if (stats.throughputRatio < tp.collapsed) raise("COLLAPSED", "throughput");
  else if (stats.throughputRatio < tp.strained) raise("STRAINED", "throughput");
  else if (stats.throughputRatio < tp.borderline) raise("BORDERLINE", "throughput");

  // 4. Latency: relative to the baseline and against fixed limits
  if (stats.p95 !== null) {
    const limits = latencyLimits(baseline);
    if (limits) {
      if (stats.p95 >= limits.strained) raise("STRAINED", "latencyRelative");
      else if (stats.p95 >= limits.borderline) raise("BORDERLINE", "latencyRelative");
    }

    if (stats.p95 >= T.absolute.strainedMs) raise("STRAINED", "latencyAbsolute");
    else if (stats.p95 >= T.absolute.borderlineMs) raise("BORDERLINE", "latencyAbsolute");
  }

  // 5. Rising trend (queue buildup)
  const trend = detectTrend(seconds);
  if (trend) raise("BORDERLINE", "rising");

  return { stats, state, reasons, trend };
}