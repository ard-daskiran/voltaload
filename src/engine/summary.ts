import { prisma } from "../db/prisma.js";
import { percentileIndex } from "./windowStats.js";

// Rows that count toward latency: responses that arrived + TIMEOUTs.
// Connection errors return instantly and would artificially lower the average, so they're excluded.
function latencyWhere(testRunId: string) {
  return {
    testRunId,
    OR: [{ errorType: null }, { errorType: "TIMEOUT" }],
  };
}

export interface TestSummary {
  totalRequests: number;
  avgResponseTime: number | null;
  minResponseTime: number | null;
  maxResponseTime: number | null;
  p95: number | null;
  p99: number | null;
  stdDev: number | null;
  serverErrorCount: number;
  totalBytes: bigint;
  actualDurationMs: number;
}

export async function computeTestSummary(testRunId: string): Promise<TestSummary> {
  // The test's start time (missing in old tests: then it counts from the first response)
  const run = await prisma.testRun.findUnique({ where: { id: testRunId }, select: { startedAt: true } });

  const totalRequests = await prisma.testResult.count({ where: { testRunId } });
  const latencyCount = await prisma.testResult.count({ where: latencyWhere(testRunId) });

  const latencyAgg = await prisma.testResult.aggregate({
    where: latencyWhere(testRunId),
    _avg: { responseTime: true },
    _min: { responseTime: true },
    _max: { responseTime: true },
  });

  const allAgg = await prisma.testResult.aggregate({
    where: { testRunId },
    _min: { timestamp: true },
    _max: { timestamp: true },
    _sum: { responseSize: true },
  });

  // Server-side errors: 5xx + every request with no response (TIMEOUT and connection errors)
  const serverErrorCount = await prisma.testResult.count({
    where: {
      testRunId,
      OR: [{ statusCode: { gte: 500 } }, { errorType: { not: null } }],
    },
  });

  // Standard deviation: sqrt(mean(x²) - mean(x)²)
  let stdDev: number | null = null;
  const avg = latencyAgg._avg.responseTime;

  if (avg !== null && latencyCount > 0) {
    const rows = (await prisma.$queryRaw`
      SELECT AVG(responseTime * responseTime) as avgSq
      FROM TestResult
      WHERE testRunId = ${testRunId} AND (errorType IS NULL OR errorType = 'TIMEOUT')
    `) as any[];

    const avgSq = Number(rows[0]?.avgSq ?? 0);
    stdDev = Math.sqrt(Math.max(0, avgSq - avg * avg));
  }

  // Percentile: sort by duration, take the value at the matching rank
  async function percentile(p: number): Promise<number | null> {
    if (latencyCount === 0) return null;

    const offset = percentileIndex(latencyCount, p);
    const row = await prisma.testResult.findFirst({
      where: latencyWhere(testRunId),
      orderBy: { responseTime: "asc" },
      skip: offset,
      select: { responseTime: true },
    });
    return row?.responseTime ?? null;
  }

  // Actual duration: from the test start to the last response's arrival (from the first response in old tests without a start time).
  // The last request is sent 1/RPS before the duration ends, so in very short, low-RPS tests the duration comes out slightly short
  // and the achieved RPS slightly high (10 RPS × 1 s → ~11). The difference disappears in longer tests.
  let actualDurationMs = 0;
  const start = run?.startedAt ?? allAgg._min.timestamp;
  if (start && allAgg._max.timestamp) {
    actualDurationMs = Math.max(0, allAgg._max.timestamp.getTime() - start.getTime());
  }

  return {
    totalRequests,
    avgResponseTime: avg,
    minResponseTime: latencyAgg._min.responseTime,
    maxResponseTime: latencyAgg._max.responseTime,
    p95: await percentile(0.95),
    p99: await percentile(0.99),
    stdDev,
    serverErrorCount,
    totalBytes: BigInt(allAgg._sum.responseSize ?? 0),
    actualDurationMs,
  };
}