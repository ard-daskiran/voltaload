// thresholds.ts
// All analysis thresholds in one place. Tuned here as results from real tests come in.
// Comparisons: "at least this value → at least this state" (threshold inclusive). Throughput is the reverse: "below this ratio".

export const THRESHOLDS = {
  // The first second is skipped: latency is always a bit higher while connections are being set up
  warmupSeconds: 1,

  // Baseline: look at up to this many seconds after the warm-up
  baselineSeconds: 3,

  // If the error rate (5xx + no response) is at least this value → at least this state
  errorRate: { borderline: 0.01, strained: 0.05, collapsed: 0.25 },

  // If connection errors (refused, reset) are at least this ratio → collapsed
  connectionErrorRate: 0.01,

  // Successful requests / target requests. If it drops BELOW this ratio → at least this state
  throughput: { borderline: 0.9, strained: 0.75, collapsed: 0.5 },

  // p95 relative to the baseline: "N times or +X ms, whichever is larger" (at least this value → this state)
  // (so trivial differences like 3 ms → 7 ms on very fast endpoints don't raise an alarm)
  relative: {
    borderlineRatio: 2,
    borderlineMinExtraMs: 50,
    strainedRatio: 5,
    strainedMinExtraMs: 200,
  },

  // Fixed limits for p95 (regardless of the baseline)
  absolute: { borderlineMs: 500, strainedMs: 1000 },

  // Latency steadily rising under the same load (queue buildup)
  trend: { ratio: 1.5, minExtraMs: 100, minSeconds: 4 },

  // How many consecutive seconds an event must last to count
  sustainedSeconds: 2,

  // Thresholds for recommendations
  recommend: {
    codeShare: 0.01, // A recommendation appears if an error type is at least 1% of responses
    timeoutDominantShare: 0.9, // If 90% of requests are timeouts, the problem is the request itself, not the load
    clientErrorShare: 0.5, // If half the responses are 4xx (excluding 429): "test settings may be wrong"
    redirectShare: 0.5, // Warning if half the responses are redirects
    rateLimitedShare: 0.5, // If half the responses are 429, what's being measured is the rate limiter
    connectionDominantShare: 0.5, // If half the requests are connection errors, nothing can be said about capacity
    tailRatio: 3, // p99 is at least this many times p95...
    tailMinExtraMs: 100, // ...and at least this much higher: "occasional very slow requests" (no alarm for 0 → 1 ms on fast endpoints)
    lowRps: 10, // If the average target RPS is below this, percentiles aren't reliable
  },

  // Settings for the suggested follow-up test
  followUp: {
    stepCount: 10,
    durationSeconds: 30,
    nearLimitFactor: 1.5, // In the "near the limit" recommendation, how many times the tested load to go up to
  },
} as const;