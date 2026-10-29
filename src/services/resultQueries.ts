// Calculations from saved results:
//   getLiveWindows → data so far, in the same shape as the live stream (used by the live chart and the detail page)
//   getTestDetail  → the test's record and summary (detail page)
// Both return null if the test isn't found.

import { prisma } from "../db/prisma.js";
import { computeTestSummary } from "../engine/summary.js";
import { targetRpsAt } from "../engine/scheduler.js";
import { summarizeWindow } from "../engine/windowStats.js";
import { LIVE_WINDOW_MS } from "../config.js";
import { serializeRun, profileOf, parseHeaders } from "./testRunFormat.js";
import { targetNamesFor } from "./savedTargets.js";

type TestRunRecord = NonNullable<Awaited<ReturnType<typeof prisma.testRun.findUnique>>>;

// --- Summary ---

// If the test has ended the summary is read from the record; if it's still running it's computed on the spot.
// null if no response was received at all (the UI shows the "no measurable responses" message).
async function loadSummary(testRun: TestRunRecord) {
  const source =
    testRun.status !== "RUNNING" && testRun.totalRequests !== null
      ? {
          totalRequests: testRun.totalRequests,
          avgResponseTime: testRun.avgResponseTime,
          minResponseTime: testRun.minResponseTime,
          maxResponseTime: testRun.maxResponseTime,
          p95: testRun.p95,
          p99: testRun.p99,
          stdDev: testRun.stdDev,
          serverErrorCount: testRun.serverErrorCount ?? 0,
          totalBytes: testRun.totalBytes ?? BigInt(0),
          actualDurationMs: testRun.actualDurationMs ?? 0,
        }
      : await computeTestSummary(testRun.id);

  if (!(source.totalRequests > 0 && source.avgResponseTime !== null)) return null;

  return {
    totalRequests: source.totalRequests,
    avgResponseTime: source.avgResponseTime,
    minResponseTime: source.minResponseTime,
    maxResponseTime: source.maxResponseTime,
    p95: source.p95,
    p99: source.p99,
    stdDev: source.stdDev,
    serverErrorCount: source.serverErrorCount,
    totalBytes: Number(source.totalBytes),
    durationMs: source.actualDurationMs,
  };
}

// --- Live windows ---

// A test's data so far, in the SAME shape as the live stream (LIVE_WINDOW_MS windows, empty ones included).
// When the live page reloads and on the detail page, the chart is drawn from these windows.
// untilWindow: if given, only windows before this one (for a running test, those already sent on the live stream)
export async function getLiveWindows(id: string, untilWindow?: number) {
  const testRun = await prisma.testRun.findUnique({ where: { id } });
  if (!testRun) return null;

  const rows = await prisma.testResult.findMany({
    where: { testRunId: id },
    orderBy: { timestamp: "asc" },
    select: { statusCode: true, errorType: true, responseTime: true, responseSize: true, timestamp: true },
  });

  const profile = profileOf(testRun);

  // Windows are counted from the test start (same as the live stream and analysis). In old tests, from the first response.
  const origin = testRun.startedAt?.getTime() ?? (rows.length > 0 ? rows[0].timestamp.getTime() : 0);
  const groups = new Map<number, typeof rows>();

  for (const row of rows) {
    const index = Math.max(0, Math.floor((row.timestamp.getTime() - origin) / LIVE_WINDOW_MS));
    const group = groups.get(index);
    if (group) group.push(row);
    else groups.set(index, [row]);
  }

  const lastIndex =
    untilWindow !== undefined ? untilWindow - 1 : groups.size > 0 ? Math.max(...groups.keys()) : -1;
  const windows = [];

  for (let index = 0; index <= lastIndex; index++) {
    const s = summarizeWindow(groups.get(index) ?? []);
    // Its time is the window's end (same as the live stream)
    const elapsedSeconds = ((index + 1) * LIVE_WINDOW_MS) / 1000;

    windows.push({
      ...s,
      elapsedSeconds,
      bytesPerSecond: s.bytes / (LIVE_WINDOW_MS / 1000),
      windowSeconds: LIVE_WINDOW_MS / 1000,
      targetRps: targetRpsAt(
        (index * LIVE_WINDOW_MS + LIVE_WINDOW_MS / 2) / 1000,
        testRun.targetRps,
        testRun.duration,
        profile
      ),
      lagMs: 0,
      voltaOverloaded: false,
    });
  }

  return windows;
}

// --- Detail page ---

// The test's record and summary. Chart data comes separately from getLiveWindows.
export async function getTestDetail(id: string) {
  const testRun = await prisma.testRun.findUnique({ where: { id } });
  if (!testRun) return null;

  const names = await targetNamesFor([testRun.url]);

  return {
    testRun: {
      ...serializeRun(testRun),
      headers: parseHeaders(testRun.headers),
      targetName: names.get(testRun.url) ?? null,
    },
    summary: await loadSummary(testRun),
  };
}