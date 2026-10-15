// Timeline. A problem counts as an event only if it lasts at least "sustainedSeconds" consecutive seconds
// (so one-second spikes don't cause false alarms).
// "Errors started" and "peak" count only response-side server errors (5xx, timeout).
// Connection errors are shown with their own event ("Cannot connect to the server"), so the same thing isn't reported twice.

import { THRESHOLDS as T } from "./thresholds.js";
import { type SecondStats } from "./seconds.js";
import { latencyLimits } from "./classify.js";
import type { Baseline } from "./baseline.js";
import type { StepRange, StepResult } from "./steps.js";
import { isServerError, isConnectionError, percentileOf } from "../engine/windowStats.js";

export type AnalysisEvent =
  | { type: "start"; second: number; rps: number }
  | { type: "step"; second: number; index: number; rps: number }
  | { type: "unhealthyFromStart"; second: number }
  | { type: "latencyRise"; second: number; from: number; to: number }
  | { type: "queueRising"; second: number; from: number; to: number }
  | { type: "errorsStart"; second: number; codes: string[] }
  | { type: "errorPeak"; second: number; rate: number }
  | { type: "connectionLost"; second: number }
  | { type: "recovered"; second: number }
  | { type: EndEventType; second: number };

// How the test ended: completed, stopped, interrupted (Volta shut down), ended with an error
export type EndEventType = "end" | "stopped" | "interrupted" | "failed";


// First second where the condition holds for "sustainedSeconds" consecutive seconds
function firstSustained(seconds: SecondStats[], test: (s: SecondStats) => boolean, fromPosition = 0): number {
  let run = 0;
  for (let i = fromPosition; i < seconds.length; i++) {
    run = test(seconds[i]) ? run + 1 : 0;
    if (run >= T.sustainedSeconds) return i - run + 1;
  }
  return -1;
}

// Response-side error codes in a second (5xx and timeout; connection errors excluded).
// Status codes are keyed by number ("503"), missing responses by error type ("TIMEOUT").
function responseErrorCodes(second: SecondStats): string[] {
  return Object.keys(second.statusCounts)
    .map((code) => ({ code, statusCode: Number(code) || 0, errorType: Number(code) ? null : code }))
    .filter((r) => isServerError(r) && !isConnectionError(r))
    .map((r) => r.code)
    .sort();
}

// Response-side error rate: all server errors minus connection errors
const responseErrorRateOf = (s: SecondStats) => (s.total > 0 ? (s.serverErrors - s.connectionErrors) / s.total : 0);
const hasResponseErrors = (s: SecondStats) => s.total > 0 && responseErrorRateOf(s) >= T.errorRate.borderline;
const isDisconnected = (s: SecondStats) =>
  (s.total === 0 && s.targetRps > 0) || (s.total > 0 && s.connectionErrors / s.total >= T.connectionErrorRate);
const isRecovered = (s: SecondStats) => s.total > 0 && s.connectionErrors === 0 && !hasResponseErrors(s);

export function buildEvents(
  seconds: SecondStats[],
  ranges: StepRange[],
  steps: StepResult[],
  baseline: Baseline,
  isStepped: boolean,
  endSecond: number, // When the test ended (for a completed test, the second the last response arrived)
  endType: EndEventType
): AnalysisEvent[] {
  const events: AnalysisEvent[] = [];
  if (seconds.length === 0) return events;

  events.push({ type: "start", second: 0, rps: Math.round(seconds[0].targetRps) });

  // Step transitions
  if (isStepped) {
    for (const range of ranges.slice(1)) {
      if (range.from >= endSecond) break;
      const step = steps.find((s) => s.index === range.index);
      if (step) events.push({ type: "step", second: range.from, index: range.index, rps: step.targetRps });
    }
  }

  // Latency rise (relative to the baseline if there is one, otherwise "strained from the start")
  const limits = latencyLimits(baseline);
  if (limits) {
    const i = firstSustained(seconds, (s) => {
      const p95 = percentileOf(s.latencies, 0.95);
      return p95 !== null && p95 >= limits.borderline;
    });
    if (i >= 0) {
      events.push({
        type: "latencyRise",
        second: seconds[i].index,
        from: baseline.p95!,
        to: percentileOf(seconds[i].latencies, 0.95)!,
      });
    }
  } else if (baseline.measured) {
    // There were measurable seconds but they weren't healthy. (If nothing could be measured, i.e. the server
    // couldn't be reached from the start, the "Cannot connect to the server" event already covers it.)
    events.push({ type: "unhealthyFromStart", second: 0 });
  }

  // Queue buildup (latency steadily rising within a step or a constant test)
  for (const step of steps) {
    if (step.trend) {
      const middle = step.fromSecond + Math.floor((step.toSecond - step.fromSecond) / 2);
      events.push({ type: "queueRising", second: middle, from: step.trend.from, to: step.trend.to });
    }
  }

  // Start and peak of response-side errors
  const errorsAt = firstSustained(seconds, hasResponseErrors);
  if (errorsAt >= 0) {
    events.push({ type: "errorsStart", second: seconds[errorsAt].index, codes: responseErrorCodes(seconds[errorsAt]) });

    let peak = seconds[errorsAt];
    for (const s of seconds) if (responseErrorRateOf(s) > responseErrorRateOf(peak)) peak = s;
    if (peak.index !== seconds[errorsAt].index && responseErrorRateOf(peak) >= T.errorRate.strained) {
      events.push({ type: "errorPeak", second: peak.index, rate: responseErrorRateOf(peak) });
    }
  }

  // Connection lost and recovery
  const lostAt = firstSustained(seconds, isDisconnected);
  if (lostAt >= 0) {
    events.push({ type: "connectionLost", second: seconds[lostAt].index });
    const recoveredAt = firstSustained(seconds, isRecovered, lostAt + T.sustainedSeconds);
    if (recoveredAt >= 0) events.push({ type: "recovered", second: seconds[recoveredAt].index });
  }

  events.push({ type: endType, second: endSecond });

  // Sort by time (events in the same second keep their insertion order)
  return events
    .map((e, order) => ({ e, order }))
    .sort((a, b) => a.e.second - b.e.second || a.order - b.order)
    .map(({ e }) => e);
}