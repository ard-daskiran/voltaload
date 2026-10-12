// Analizin giriş noktası: testin ham sonuçlarını okur, kuralları sırayla uygular.
// Sonuç cümle değil veridir; cümleleri arayüz sözlükten kurar.

import { prisma } from "../db/prisma.js";
import { profileOf } from "../services/testRunFormat.js";
import { WORKER_LAG_WARNING_MS } from "../config.js";
import { THRESHOLDS as T } from "./thresholds.js";
import { buildSeconds, type SecondStats } from "./seconds.js";
import { aggregate, classifyGroup } from "./classify.js";
import { findBaseline, type Baseline } from "./baseline.js";
import { stepRanges, analyzeSteps } from "./steps.js";
import { buildEvents, type AnalysisEvent } from "./events.js";
import { buildVerdict, type Outage } from "./verdict.js";
import { buildRecommendations } from "./recommendations.js";

// Bağlantı koptuysa ve öncesinde sunucu sağlıklıysa: kesinti.
// Kapasite yine temkinli kalır, sadece cümle "o ana kadar karşıladı, sonra koptu" der.
function findOutage(seconds: SecondStats[], events: AnalysisEvent[], baseline: Baseline): Outage | null {
  const lost = events.find((e) => e.type === "connectionLost");
  if (!lost) return null;

  const before = seconds.filter((s) => s.index >= T.warmupSeconds && s.index < lost.second);
  if (before.length === 0) return null;

  if (classifyGroup(before, baseline).state !== "HEALTHY") return null;
  return { second: lost.second, rps: Math.round(Math.max(...before.map((s) => s.targetRps))) };
}

export async function analyzeTestRun(id: string) {
  const testRun = await prisma.testRun.findUnique({ where: { id } });
  if (!testRun) return null;

  // Test bitmeden analiz yapılmaz
  if (testRun.status === "RUNNING") return { status: "pending" as const };

  const rows = await prisma.testResult.findMany({
    where: { testRunId: id },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, statusCode: true, errorType: true, responseTime: true },
  });
  if (rows.length === 0) return { status: "empty" as const };

  const profile = profileOf(testRun);
  const stopped = testRun.status !== "COMPLETED";

  // Durdurulan ya da yarıda kalan testte sadece durana kadarki saniyeler analiz edilir.
  // Yoksa durduktan sonraki "cevapsız" saniyeler, sunucu çökmüş gibi görünür.
    // Saniyeler testin başlangıcından sayılır. Eski testlerde başlangıç kaydı yok, ilk cevaptan sayılır.
  const origin = testRun.startedAt?.getTime() ?? rows[0].timestamp.getTime();

  let effectiveDuration = testRun.duration;
  if (stopped && testRun.finishedAt) {
    const stoppedAt = Math.floor((testRun.finishedAt.getTime() - origin) / 1000);
    effectiveDuration = Math.max(1, Math.min(testRun.duration, stoppedAt));
  }

  const allSeconds = buildSeconds(rows, {
    origin,
    configuredDuration: testRun.duration,
    effectiveDuration,
    targetRps: testRun.targetRps,
    profile,
  });

  // Tamamlanan testte süre bittikten sonra gelen cevaplar da analize girer (son kademeye eklenir).
  // Durdurulan testte girmez.
  const seconds = stopped ? allSeconds.filter((s) => s.inTest) : allSeconds;
  const endSecond = stopped ? effectiveDuration : seconds[seconds.length - 1].index + 1;

  const ranges = stepRanges(testRun.duration, profile, testRun.targetRps);
  const baseline = findBaseline(seconds, ranges[0].to);
  const steps = analyzeSteps(seconds, ranges, baseline);
  if (steps.length === 0) return { status: "empty" as const };

  const events = buildEvents(seconds, ranges, steps, baseline, profile.type === "STEPPED", endSecond, stopped);
  const verdict = buildVerdict(steps, baseline, findOutage(seconds, events, baseline));
  const recommendations = buildRecommendations(aggregate(seconds), verdict);

  return {
    status: "ready" as const,
    stopped,
    verdict,
    baseline,
    voltaOverloaded: testRun.maxLagMs !== null && testRun.maxLagMs > WORKER_LAG_WARNING_MS,
    // Kademe tablosu sadece kademeli testlerde anlamlı
    steps: profile.type === "STEPPED" ? steps : [],
    events,
    recommendations,
  };
}