// Analizin giriş noktası: testin ham sonuçlarını okur, kuralları sırayla uygular.
// Sonuç cümle değil veridir; cümleleri arayüz sözlükten kurar.

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

// Testin nasıl bittiği → olay listesinin son satırı
const END_EVENTS: Record<string, EndEventType> = {
  COMPLETED: "end",
  STOPPED: "stopped",
  INTERRUPTED: "interrupted",
  FAILED: "failed",
};

// Durdurulan testin son saniyesinin en az bu kadarı test içindeyse analize girer.
// Daha azı (örneğin 10,05'te durdurmada 0,05 sn) birkaç istekten ibaret, sonuçları bozar.
const MIN_PARTIAL_SECOND = 0.5;

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

// En son gönderilen isteğin anı (yarıda kalan testte kesin durma anı kayıtlı değil)
function lastSentAt(rows: ResultRow[]): number {
  let last = 0;
  for (const row of rows) last = Math.max(last, row.timestamp.getTime() - row.responseTime);
  return last;
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

  // Saniyeler testin başlangıcından sayılır. Eski testlerde başlangıç kaydı yok, ilk cevaptan sayılır.
  const origin = testRun.startedAt?.getTime() ?? rows[0].timestamp.getTime();

  // Analiz edilen süre (sn). Tamamlanan testte ayarlanan süre. Durdurulan, yarıda kalan ya da hatayla biten testte
  // cevabı kaydedilmiş en son isteğin GÖNDERİLDİĞİ an. Durdurma anı değil: durdurunca yoldaki isteklerin cevapları
  // hiç gelmez (her isteği 2 sn süren sunucuda son 2 saniyenin hepsi), onların saniyeleri "gönderildi ama cevap yok"
  // görünüp sunucu çökmüş sanılmasın. Durduruluşta kaydedilemeyen son paket de böylece analizi bozmaz.
  // (Yarıda kalan testte kesin durma anı zaten kayıtlı değil, eski kayıtlarda bitiş anı Volta'nın yeniden açıldığı an.)
  let effectiveDuration = testRun.duration;
  if (stopped) {
    const stopAt = Math.min(testRun.duration, (lastSentAt(rows) - origin) / 1000);
    const whole = Math.floor(stopAt);
    effectiveDuration = stopAt - whole >= MIN_PARTIAL_SECOND ? stopAt : whole;
  }

  // 1 saniyeden kısa testin analizi yanıltıcı olur (birkaç yüz milisaniyelik veri)
  if (effectiveDuration < 1) return { status: "tooShort" as const };

  const seconds = buildSeconds(rows, {
    origin,
    configuredDuration: testRun.duration,
    effectiveDuration,
    targetRps: testRun.targetRps,
    profile,
  });

  // Olay listesinin son satırı: tamamlanan testte son cevabın GELDİĞİ saniye (zaman aşımları dahil test o an bitti),
  // durdurulan testte durma anının saniyesi
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
    endReason: testRun.status, // STOPPED / INTERRUPTED / FAILED: arayüz uyarı metnini buna göre seçer
    verdict,
    baseline,
    voltaOverloaded: testRun.maxLagMs !== null && testRun.maxLagMs > WORKER_LAG_WARNING_MS,
    // Kademe tablosu sadece kademeli testlerde anlamlı
    steps: profile.type === "STEPPED" ? steps : [],
    events,
    recommendations,
  };
}