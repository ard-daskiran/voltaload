import { prisma } from "../db/prisma.js";
import { percentileIndex } from "./windowStats.js";

// Gecikme hesaplarına giren satırlar: cevap gelenler + TIMEOUT'lar.
// Bağlantı hataları anında döndüğü için ortalamayı yapay olarak düşürür, hariç tutulur.
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
  // Testin başlangıç anı (eski testlerde yok: o zaman ilk cevaptan sayılır)
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

  // Sunucu kaynaklı hatalar: 5xx + cevap gelmeyen her istek (TIMEOUT ve bağlantı hataları)
  const serverErrorCount = await prisma.testResult.count({
    where: {
      testRunId,
      OR: [{ statusCode: { gte: 500 } }, { errorType: { not: null } }],
    },
  });

  // Standart sapma: sqrt(ortalama(x²) - ortalama(x)²)
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

  // Yüzdelik dilim: süreye göre sırala, ilgili sıradaki değeri al
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

  // Gerçek süre: testin başlangıcından son cevaba kadar.
  // (İlk cevaptan saymak, N cevap için N−1 aralık verir ve RPS'i az istekli testlerde şişirir.)
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