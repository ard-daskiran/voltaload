// Bir grup saniyenin (bir kademe ya da sabit testin tamamı) durumu:
// sağlıklı / sınırda / zorlandı / çöktü. Dört ölçünün en kötüsü belirler.

import { THRESHOLDS as T } from "./thresholds.js";
import { percentile, median, type SecondStats } from "./seconds.js";
import type { Baseline } from "./baseline.js";

export type HealthState = "HEALTHY" | "BORDERLINE" | "STRAINED" | "COLLAPSED";

// Durumun neden o olduğu (arayüz bunları açıklama olarak gösterebilir)
export type Reason =
  | "errors"
  | "connectionErrors"
  | "noResponses"
  | "throughput"
  | "latencyRelative"
  | "latencyAbsolute"
  | "rising";

const RANK: Record<HealthState, number> = { HEALTHY: 0, BORDERLINE: 1, STRAINED: 2, COLLAPSED: 3 };

function worst(a: HealthState, b: HealthState): HealthState {
  return RANK[a] >= RANK[b] ? a : b;
}

export interface GroupStats {
  secondCount: number;
  expected: number; // Hedeflenen toplam istek
  total: number;
  success: number;
  serverErrors: number;
  connectionErrors: number;
  timeouts: number;
  statusCounts: Record<string, number>;
  latencies: number[];
  avg: number | null;
  p95: number | null;
  p99: number | null;
  errorRate: number;
  connectionErrorRate: number;
  throughputRatio: number;
  actualRps: number;
  targetRps: number;
}

// Saniyeleri birleştirir. p95/p99 bütün gecikmelerden yeniden hesaplanır (saniyelik p95'lerin ortalaması değil).
export function aggregate(seconds: SecondStats[]): GroupStats {
  const statusCounts: Record<string, number> = {};
  const latencies: number[] = [];
  let expected = 0, total = 0, success = 0, serverErrors = 0, connectionErrors = 0, timeouts = 0;
  // Sadece hedefin olduğu saniyelerdeki başarılılar. Test bittikten sonra gelen geç cevaplar
  // (önceki saniyelerde gönderilip kuyrukta beklemiş) gerçekleşen RPS'i şişirmesin.
  let successInTarget = 0;

  for (const s of seconds) {
    expected += s.targetRps;
    total += s.total;
    success += s.success;
    if (s.targetRps > 0) successInTarget += s.success;
    serverErrors += s.serverErrors;
    connectionErrors += s.connectionErrors;
    timeouts += s.timeouts;
    for (const [code, count] of Object.entries(s.statusCounts)) {
      statusCounts[code] = (statusCounts[code] || 0) + count;
    }
    for (const latency of s.latencies) latencies.push(latency);
  }

  latencies.sort((a, b) => a - b);

  // Saniye başına değerler (gerçekleşen RPS, ortalama hedef) hedefin olduğu saniyelerin SÜRESİNE bölünür.
  // Durdurulan testin son saniyesi kısmi olabilir (0,6 sn'de 180 istek = 300 RPS, 180 değil).
  const targetSpan = seconds.filter((s) => s.targetRps > 0).reduce((sum, s) => sum + s.span, 0);
  const n = targetSpan > 0 ? targetSpan : Math.max(1, seconds.length);

  return {
    secondCount: seconds.length,
    expected,
    total,
    success,
    serverErrors,
    connectionErrors,
    timeouts,
    statusCounts,
    latencies,
    avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
    p95: percentile(latencies, 0.95),
    p99: percentile(latencies, 0.99),
    errorRate: total > 0 ? serverErrors / total : 0,
    connectionErrorRate: total > 0 ? connectionErrors / total : 0,
    throughputRatio: expected > 0 ? successInTarget / expected : 1,
    actualRps: successInTarget / n,
    targetRps: expected / n,
  };
}

// Sağlıklı seviyeye göre gecikme sınırları ("N katı ya da +X ms, hangisi büyükse")
export function latencyLimits(baseline: Baseline): { borderline: number; strained: number } | null {
  if (!baseline.valid || baseline.p95 === null) return null;
  const b = baseline.p95;
  const r = T.relative;
  return {
    borderline: Math.max(b * r.borderlineRatio, b + r.borderlineMinExtraMs),
    strained: Math.max(b * r.strainedRatio, b + r.strainedMinExtraMs),
  };
}

// Aynı yük altında gecikme sürekli artıyor mu? (ilk saniyelerin ve son saniyelerin p95 ortancası)
function detectTrend(seconds: SecondStats[]): { from: number; to: number } | null {
  const p95s = seconds.map((s) => percentile(s.latencies, 0.95)).filter((v): v is number => v !== null);
  if (p95s.length < T.trend.minSeconds) return null;

  const k = Math.min(3, Math.floor(p95s.length / 2));
  const from = median(p95s.slice(0, k))!;
  const to = median(p95s.slice(-k))!;

  if (to > from * T.trend.ratio && to - from >= T.trend.minExtraMs) {
    return { from: Math.round(from), to: Math.round(to) };
  }
  return null;
}

export interface Classification {
  stats: GroupStats;
  state: HealthState;
  reasons: Reason[];
  trend: { from: number; to: number } | null;
}

export function classifyGroup(seconds: SecondStats[], baseline: Baseline): Classification {
  const stats = aggregate(seconds);
  const reasons: Reason[] = [];
  let state: HealthState = "HEALTHY";

  const raise = (to: HealthState, reason: Reason) => {
    if (RANK[to] > RANK.HEALTHY && !reasons.includes(reason)) reasons.push(reason);
    state = worst(state, to);
  };

  // Hedef vardı ama hiç cevap gelmedi
  if (stats.total === 0) {
    if (stats.expected > 0) raise("COLLAPSED", "noResponses");
    return { stats, state, reasons, trend: null };
  }

  // 1. Hata oranı
  const e = T.errorRate;
  if (stats.errorRate >= e.collapsed) raise("COLLAPSED", "errors");
  else if (stats.errorRate >= e.strained) raise("STRAINED", "errors");
  else if (stats.errorRate >= e.borderline) raise("BORDERLINE", "errors");

  // 2. Bağlantı hatası (sunucu kapandı ya da bağlantıyı kesti)
  if (stats.connectionErrorRate >= T.connectionErrorRate) raise("COLLAPSED", "connectionErrors");

  // 3. Başarılı istek / hedeflenen
  const tp = T.throughput;
  if (stats.throughputRatio < tp.collapsed) raise("COLLAPSED", "throughput");
  else if (stats.throughputRatio < tp.strained) raise("STRAINED", "throughput");
  else if (stats.throughputRatio < tp.borderline) raise("BORDERLINE", "throughput");

  // 4. Gecikme: sağlıklı seviyeye göre ve sabit sınırlara göre
  if (stats.p95 !== null) {
    const limits = latencyLimits(baseline);
    if (limits) {
      if (stats.p95 >= limits.strained) raise("STRAINED", "latencyRelative");
      else if (stats.p95 >= limits.borderline) raise("BORDERLINE", "latencyRelative");
    }

    if (stats.p95 >= T.absolute.strainedMs) raise("STRAINED", "latencyAbsolute");
    else if (stats.p95 >= T.absolute.borderlineMs) raise("BORDERLINE", "latencyAbsolute");
  }

  // 5. Yükselme eğilimi (kuyruk birikiyor)
  const trend = detectTrend(seconds);
  if (trend) raise("BORDERLINE", "rising");

  return { stats, state, reasons, trend };
}