// Entry point of the analysis: reads the test's raw results and applies the rules in order.
// The result is data, not sentences; the UI builds the sentences from the dictionary.

import { prisma } from "../db/prisma.js";
import { profileOf } from "../services/testRunFormat.js";
import { WORKER_LAG_WARNING_MS } from "../config.js";
import { THRESHOLDS as T } from "./thresholds.js";
import { buildSeconds, type ResultRow, type SecondStats } from "./seconds.js";
import { aggregate, classifyGroup } from "./classify.js";
import { findBaseline, type Baseline } from "./baseline.js";
import { stepRanges, analyzeSteps } from "./steps.js";
import { buildEvents, type AnalysisEvent, type EndEventType } from "./events.js";
import { buildVerdict, type Outage } from "./verdict.js";
import { buildRecommendations } from "./recommendations.js";

// How the test ended → the last row of the event list
const END_EVENTS: Record<string, EndEventType> = {
  COMPLETED: "end",
  STOPPED: "stopped",
  INTERRUPTED: "interrupted",
  FAILED: "failed",
};

// The last second of a stopped test is analyzed if at least this much of it is within the test.
// Less than that (e.g. 0.05 s when stopped at 10.05) is just a few requests and skews the results.
const MIN_PARTIAL_SECOND = 0.5;

// If the connection was lost and the server was healthy before that: an outage.
// Capacity stays conservative; only the sentence says "it handled the load until then, then the connection was lost".
function findOutage(seconds: SecondStats[], events: AnalysisEvent[], baseline: Baseline): Outage | null {
  const lost = events.find((e) => e.type === "connectionLost");
  if (!lost) return null;

  const before = seconds.filter((s) => s.index >= T.warmupSeconds && s.index < lost.second);
  if (before.length === 0) return null;

  if (classifyGroup(before, baseline).state !== "HEALTHY") return null;
  return { second: lost.second, rps: Math.round(Math.max(...before.map((s) => s.targetRps))) };
}

// Send time of the first request (for old tests without a recorded start time)
function firstSentAt(rows: ResultRow[]): number {
  let first = Infinity;
  for (const row of rows) first = Math.min(first, row.timestamp.getTime() - row.responseTime);
  return first;
}

// Send time of the last request (an interrupted test has no exact stop time recorded)
function lastSentAt(rows: ResultRow[]): number {
  let last = 0;
  for (const row of rows) last = Math.max(last, row.timestamp.getTime() - row.responseTime);
  return last;
}

export async function analyzeTestRun(id: string) {
  const testRun = await prisma.testRun.findUnique({ where: { id } });
  if (!testRun) return null;

  // No analysis until the test has ended
  if (testRun.status === "RUNNING") return { status: "pending" as const };

  const rows = await prisma.testResult.findMany({
    where: { testRunId: id },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, statusCode: true, errorType: true, responseTime: true },
  });
  if (rows.length === 0) return { status: "empty" as const };

  const profile = profileOf(testRun);
  const stopped = testRun.status !== "COMPLETED";

  // Seconds are counted from the test start. Old tests have no recorded start: use the first request's send time
  // (since results are placed in the second they were sent, the start must also be a send time, not the first arrival time).
  const origin = testRun.startedAt?.getTime() ?? firstSentAt(rows);

  // Analyzed duration (s). For a completed test, the configured duration. For a stopped, interrupted or failed test,
  // the SEND time of the last request whose response was saved. Not the stop time: on stop, responses to in-flight requests
  // never arrive (on a server where each request takes 2 s, all of the last 2 seconds), and their seconds shouldn't look like
  // "sent but no response" and make the server seem collapsed. This way the last batch that couldn't be saved on stop doesn't skew the analysis either.
  // (An interrupted test has no exact stop time recorded anyway; in old records the end time is when Volta restarted.)
  let effectiveDuration = testRun.duration;
  if (stopped) {
    const stopAt = Math.min(testRun.duration, (lastSentAt(rows) - origin) / 1000);
    const whole = Math.floor(stopAt);
    effectiveDuration = stopAt - whole >= MIN_PARTIAL_SECOND ? stopAt : whole;
  }

  // Analysis of a test shorter than 1 second would be misleading (a few hundred milliseconds of data)
  if (effectiveDuration < 1) return { status: "tooShort" as const };

  const seconds = buildSeconds(rows, {
    origin,
    configuredDuration: testRun.duration,
    effectiveDuration,
    targetRps: testRun.targetRps,
    profile,
  });

  // Last row of the event list: for a completed test, the second the last response ARRIVED (the test ended then, timeouts included),
  // for a stopped test, the second of the stop time
  const lastArrival = rows[rows.length - 1].timestamp.getTime();
  const endSecond = stopped ? Math.floor(effectiveDuration) : Math.floor((lastArrival - origin) / 1000) + 1;

  const ranges = stepRanges(testRun.duration, profile, testRun.targetRps);
  const baseline = findBaseline(seconds, ranges[0].to);
  const steps = analyzeSteps(seconds, ranges, baseline);
  if (steps.length === 0) return { status: "empty" as const };

  const endEvent = END_EVENTS[testRun.status] ?? "end";
  const events = buildEvents(seconds, ranges, steps, baseline, profile.type === "STEPPED", endSecond, endEvent);
  const verdict = buildVerdict(steps, baseline, findOutage(seconds, events, baseline));
  const recommendations = buildRecommendations(aggregate(seconds), verdict);

  return {
    status: "ready" as const,
    stopped,
    endReason: testRun.status, // STOPPED / INTERRUPTED / FAILED: the UI picks the warning text based on this
    verdict,
    baseline,
    voltaOverloaded: testRun.maxLagMs !== null && testRun.maxLagMs > WORKER_LAG_WARNING_MS,
    // The step table only makes sense for stepped tests
    steps: profile.type === "STEPPED" ? steps : [],
    events,
    recommendations,
  };
}