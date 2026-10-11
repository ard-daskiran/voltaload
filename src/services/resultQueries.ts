// Kaydedilmiş sonuçlardan hesaplar:
//   getLiveWindows → o ana kadarki veri, canlı akışla aynı biçimde (canlı grafik ve detay sayfası kullanır)
//   getTestDetail  → testin kaydı ve özeti (detay sayfası)
// İkisi de test bulunamazsa null döndürür.

import { prisma } from "../db/prisma.js";
import { computeTestSummary } from "../engine/summary.js";
import { targetRpsAt } from "../engine/scheduler.js";
import { summarizeWindow } from "../engine/windowStats.js";
import { LIVE_WINDOW_MS } from "../config.js";
import { serializeRun, profileOf } from "./testRunFormat.js";
import { targetNamesFor } from "./savedTargets.js";
type TestRunRecord = NonNullable<Awaited<ReturnType<typeof prisma.testRun.findUnique>>>;

// --- Özet ---

// Test bittiyse özet kayıttan okunur, hâlâ çalışıyorsa o an hesaplanır.
// Hiç cevap alınamadıysa null (arayüz "ölçülebilen cevap yok" mesajını gösterir).
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

// --- Canlı dilimler ---

// Bir testin o ana kadarki verisi, canlı akışla AYNI biçimde (LIVE_WINDOW_MS'lik dilimler).
// Canlı sayfa yenilenince ve detay sayfasında grafik bu dilimlerle çizilir.
export async function getLiveWindows(id: string) {
  const testRun = await prisma.testRun.findUnique({ where: { id } });
  if (!testRun) return null;

  const rows = await prisma.testResult.findMany({
    where: { testRunId: id },
    orderBy: { timestamp: "asc" },
    select: { statusCode: true, errorType: true, responseTime: true, responseSize: true, timestamp: true },
  });

  const profile = profileOf(testRun);
  const origin = rows.length > 0 ? rows[0].timestamp.getTime() : 0;
  const groups = new Map<number, typeof rows>();

  for (const row of rows) {
    const index = Math.floor((row.timestamp.getTime() - origin) / LIVE_WINDOW_MS);
    const group = groups.get(index);
    if (group) group.push(row);
    else groups.set(index, [row]);
  }

  return [...groups.keys()]
    .sort((a, b) => a - b)
    .map((index) => {
      const s = summarizeWindow(groups.get(index)!);
      // Canlı akışta dilim, süresi dolunca gönderilir. Zamanı dilimin sonu olarak al.
      const elapsedSeconds = ((index + 1) * LIVE_WINDOW_MS) / 1000;

      return {
        ...s,
        elapsedSeconds,
        bytesPerSecond: s.bytes / (LIVE_WINDOW_MS / 1000),
        windowSeconds: LIVE_WINDOW_MS / 1000,
        targetRps: targetRpsAt(
          Math.max(0, elapsedSeconds - LIVE_WINDOW_MS / 2000),
          testRun.targetRps,
          testRun.duration,
          profile
        ),
        lagMs: 0,
        voltaOverloaded: false,
      };
    });
}

// --- Detay sayfası ---

// Testin kaydı ve özeti. Grafik verisi ayrıca getLiveWindows'tan gelir.
export async function getTestDetail(id: string) {
  const testRun = await prisma.testRun.findUnique({ where: { id } });
  if (!testRun) return null;

  const names = await targetNamesFor([testRun.url]);

  return {
    testRun: { ...serializeRun(testRun), targetName: names.get(testRun.url) ?? null },
    summary: await loadSummary(testRun),
  };
}