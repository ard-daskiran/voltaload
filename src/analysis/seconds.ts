// seconds.ts
// Per-second summary from raw results: request counts, error types and sorted latencies for each second.
// Seconds are counted from the test start. Each result is placed in the second the request was SENT, not the second
// its response arrived. The analysis asks "could the server handle the load sent each second?". This way a healthy server
// with slow responses (e.g. 2 s per request) doesn't show empty first seconds and get mistaken for "connection lost".
// (The chart, on the other hand, shows responses by arrival time: "what is coming from the server right now?")
// Seconds with no results at all are also in the list (the server may have locked up).

import { isLatencySample, isServerError, isConnectionError } from "../engine/windowStats.js";
import { requestsBetween, type LoadProfile } from "../engine/scheduler.js";

// Requests that appear to be sent just after the analyzed duration (last-moment sends by the scheduler,
// millisecond rounding) go into the last second. Anything later isn't analyzed: so the requests of a short last second
// dropped from a stopped test don't get mixed into the previous second.
const END_MARGIN_MS = 50;

export interface ResultRow {
  timestamp: Date;
  statusCode: number;
  errorType: string | null;
  responseTime: number;
}

export interface SecondStats {
  index: number; // 0 → between 0–1 s
  span: number; // Analyzed part of the second (1; can be fractional for the last second of a stopped test)
  targetRps: number; // Number of requests that should be sent in that second (that part) (same calculation as the scheduler)
  inTest: boolean; // Is it within the analyzed duration?
  total: number;
  success: number; // Not server errors (4xx included)
  serverErrors: number; // 5xx + no response
  connectionErrors: number; // Refused, reset, network error
  timeouts: number;
  statusCounts: Record<string, number>;
  latencies: number[]; // Sorted (connection errors excluded)
}

// Median: a single spike skews the mean but not the median
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface BuildOptions {
  origin: number; // Moment seconds are counted from (test start, ms)
  configuredDuration: number; // The test's configured duration (for the target calculation)
  effectiveDuration: number; // Duration to analyze (s; can be fractional for a stopped test)
  targetRps: number;
  profile: LoadProfile;
}

export function buildSeconds(rows: ResultRow[], options: BuildOptions): SecondStats[] {
  if (rows.length === 0) return [];

  const { configuredDuration, effectiveDuration, targetRps, profile, origin } = options;

  // Last analyzed second
  const lastIndex = Math.max(0, Math.ceil(effectiveDuration) - 1);
  const endMs = effectiveDuration * 1000;

  const createSecond = (index: number): SecondStats => {
    // The last second of a stopped test can be partial: only what should have been sent up to the stop time
    const end = Math.min(index + 1, effectiveDuration);
    return {
      index,
      span: end - index,
      targetRps: index < configuredDuration ? requestsBetween(index, end, targetRps, configuredDuration, profile) : 0,
      inTest: index < effectiveDuration,
      total: 0,
      success: 0,
      serverErrors: 0,
      connectionErrors: 0,
      timeouts: 0,
      statusCounts: {},
      latencies: [],
    };
  };

  const byIndex = new Map<number, SecondStats>();

  for (const row of rows) {
    // Send time (from the test start, ms): arrival time − response time
    const sentOffset = row.timestamp.getTime() - row.responseTime - origin;
    if (sentOffset > endMs + END_MARGIN_MS) continue;
    const index = Math.min(Math.max(0, Math.floor(sentOffset / 1000)), lastIndex);

    let second = byIndex.get(index);
    if (!second) {
      second = createSecond(index);
      byIndex.set(index, second);
    }

    second.total++;
    const key = row.errorType ?? String(row.statusCode);
    second.statusCounts[key] = (second.statusCounts[key] || 0) + 1;

    if (isServerError(row)) second.serverErrors++;
    else second.success++;

    if (isConnectionError(row)) second.connectionErrors++;
    if (row.errorType === "TIMEOUT") second.timeouts++;
    if (isLatencySample(row)) second.latencies.push(row.responseTime);
  }

  // Continuous list, empty seconds included
  const seconds: SecondStats[] = [];
  for (let i = 0; i <= lastIndex; i++) {
    const second = byIndex.get(i) ?? createSecond(i);
    second.latencies.sort((a, b) => a - b);
    seconds.push(second);
  }

  return seconds;
}