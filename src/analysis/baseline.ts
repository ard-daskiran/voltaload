// Sağlıklı seviye: sunucunun rahat zamandaki p95'i. Gecikme artışı buna göre ölçülür.
// Ancak ilk saniyeler gerçekten sağlıklıysa geçerlidir.
// Değilse (sunucu baştan zorlandıysa) sadece sabit sınırlar, hata ve RPS kuralları uygulanır.

import { THRESHOLDS as T } from "./thresholds.js";
import { percentile, median, type SecondStats } from "./seconds.js";
import { aggregate } from "./classify.js";

export interface Baseline {
  valid: boolean;
  p95: number | null;
}

// limitIndex: bu saniyeden öncesine bak (kademeli testte ilk kademenin sonu)
export function findBaseline(seconds: SecondStats[], limitIndex: number): Baseline {
  const inRange = seconds.filter((s) => s.index < limitIndex && s.latencies.length > 0);

  // Isınma saniyesi atlanır. İlk kademe çok kısaysa (örneğin 2,5 sn) geriye tek saniye kalabilir,
  // o zaman tek saniyeyle yetinilir. Hiç kalmazsa ısınma saniyesi de kullanılır.
  let candidates = inRange.filter((s) => s.index >= T.warmupSeconds).slice(0, T.baselineSeconds);
  if (candidates.length === 0) candidates = inRange.slice(0, T.baselineSeconds);
  if (candidates.length === 0) return { valid: false, p95: null };

  const p95 = median(candidates.map((s) => percentile(s.latencies, 0.95)!))!;
  const stats = aggregate(candidates);

  const healthy =
    stats.errorRate < T.errorRate.borderline &&
    stats.connectionErrorRate < T.connectionErrorRate &&
    stats.throughputRatio >= T.throughput.borderline &&
    p95 < T.absolute.borderlineMs;

  return { valid: healthy, p95: Math.round(p95) };
}