// Kademe tablosu: her kademe ayrı değerlendirilir. Sabit yükte bütün test tek bir "kademe" sayılır.

import { THRESHOLDS as T } from "./thresholds.js";
import { classifyGroup, type HealthState, type Reason } from "./classify.js";
import type { SecondStats } from "./seconds.js";
import type { Baseline } from "./baseline.js";
import type { LoadProfile } from "../engine/scheduler.js";
import { targetRpsAt } from "../engine/scheduler.js";

export interface StepRange {
  index: number; // 1'den başlar
  from: number; // Başlangıç saniyesi (dahil)
  to: number; // Bitiş saniyesi (hariç)
  rps: number; // Kademenin hedef RPS'i (formda ve zamanlayıcıda görünen)
}

export interface StepResult {
  index: number;
  fromSecond: number;
  toSecond: number;
  targetRps: number;
  actualRps: number;
  avg: number | null;
  p95: number | null;
  p99: number | null;
  errorRate: number;
  state: HealthState;
  reasons: Reason[];
  trend: { from: number; to: number } | null;
}

// Her saniye, ortası hangi kademeye düşüyorsa o kademeye aittir (zamanlayıcıyla aynı mantık)
export function stepRanges(duration: number, profile: LoadProfile, targetRps: number): StepRange[] {
  if (profile.type !== "STEPPED") return [{ index: 1, from: 0, to: duration, rps: targetRps }];

  const stepCount = profile.stepCount ?? 1;
  const stepDuration = duration / stepCount;
  const ranges: StepRange[] = [];

  for (let s = 0; s < duration; s++) {
    const index = Math.min(stepCount, Math.floor((s + 0.5) / stepDuration) + 1);
    const current = ranges[ranges.length - 1];
    if (current && current.index === index) {
      current.to = s + 1;
    } else {
      const rps = targetRpsAt((index - 0.5) * stepDuration, targetRps, duration, profile);
      ranges.push({ index, from: s, to: s + 1, rps });
    }
  }

  return ranges;
}

export function analyzeSteps(seconds: SecondStats[], ranges: StepRange[], baseline: Baseline): StepResult[] {
  const results: StepResult[] = [];

  for (const range of ranges) {
    // Son kademe, test bittikten sonra gelen cevapları da kapsar
    // (o istekler son kademede gönderildi; zaman aşımları 2,5 sn sonra kaydedilir)
    const isLast = range === ranges[ranges.length - 1];
    const to = isLast ? Infinity : range.to;

    let group = seconds.filter((s) => s.index >= range.from && s.index < to);
    if (group.length === 0) continue; // Test bu kademeye gelmeden durduruldu

    // Isınma saniyesi, yeterince saniye kalıyorsa hariç tutulur
    const warmed = group.filter((s) => s.index >= T.warmupSeconds);
    if (warmed.length >= 2) group = warmed;

    const { stats, state, reasons, trend } = classifyGroup(group, baseline);

    results.push({
      index: range.index,
      fromSecond: range.from,
      toSecond: range.to,
      targetRps: range.rps,
      actualRps: Math.round(stats.actualRps * 10) / 10,
      avg: stats.avg !== null ? Math.round(stats.avg) : null,
      p95: stats.p95,
      p99: stats.p99,
      errorRate: stats.errorRate,
      state,
      reasons,
      trend,
    });
  }

  return results;
}