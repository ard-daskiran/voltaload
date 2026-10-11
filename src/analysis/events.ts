// Zaman çizelgesi. Bir sorun ancak üst üste en az "sustainedSeconds" saniye sürerse olay sayılır
// (tek saniyelik sıçramalar yanlış alarm üretmesin).
// "Hatalar başladı" ve "zirve" sadece sunucunun cevap tarafındaki hataları sayar (5xx, zaman aşımı).
// Bağlantı hataları kendi olayıyla gösterilir ("Sunucuya bağlanılamıyor"), aynı şey iki kez yazılmasın.

import { THRESHOLDS as T } from "./thresholds.js";
import { percentile, type SecondStats } from "./seconds.js";
import { latencyLimits } from "./classify.js";
import type { Baseline } from "./baseline.js";
import type { StepRange, StepResult } from "./steps.js";
import { isServerError } from "../engine/windowStats.js";

export type AnalysisEvent =
  | { type: "start"; second: number; rps: number }
  | { type: "step"; second: number; index: number; rps: number }
  | { type: "unhealthyFromStart"; second: number }
  | { type: "latencyRise"; second: number; from: number; to: number }
  | { type: "queueRising"; second: number; from: number; to: number }
  | { type: "errorsStart"; second: number; codes: string[] }
  | { type: "errorPeak"; second: number; rate: number }
  | { type: "connectionLost"; second: number }
  | { type: "recovered"; second: number }
  | { type: "end"; second: number }
  | { type: "stopped"; second: number };

const CONNECTION_TYPES = ["CONNECTION_REFUSED", "CONNECTION_RESET", "NETWORK_ERROR"];

// Koşulun üst üste "sustainedSeconds" saniye sağlandığı ilk saniye
function firstSustained(seconds: SecondStats[], test: (s: SecondStats) => boolean, fromPosition = 0): number {
  let run = 0;
  for (let i = fromPosition; i < seconds.length; i++) {
    run = test(seconds[i]) ? run + 1 : 0;
    if (run >= T.sustainedSeconds) return i - run + 1;
  }
  return -1;
}

// Bir saniyedeki cevap tarafı hata kodları (5xx ve zaman aşımı; bağlantı hataları hariç)
function responseErrorCodes(second: SecondStats): string[] {
  return Object.keys(second.statusCounts)
    .filter((code) => !CONNECTION_TYPES.includes(code))
    .filter((code) => isServerError({ statusCode: Number(code) || 0, errorType: Number(code) ? null : code }))
    .sort();
}

// Cevap tarafı hata oranı: bütün sunucu hataları eksi bağlantı hataları
const responseErrorRateOf = (s: SecondStats) => (s.total > 0 ? (s.serverErrors - s.connectionErrors) / s.total : 0);
const hasResponseErrors = (s: SecondStats) => s.total > 0 && responseErrorRateOf(s) >= T.errorRate.borderline;
const isDisconnected = (s: SecondStats) =>
  (s.total === 0 && s.targetRps > 0) || (s.total > 0 && s.connectionErrors / s.total >= T.connectionErrorRate);
const isRecovered = (s: SecondStats) => s.total > 0 && s.connectionErrors === 0 && !hasResponseErrors(s);

export function buildEvents(
  seconds: SecondStats[],
  ranges: StepRange[],
  steps: StepResult[],
  baseline: Baseline,
  isStepped: boolean,
  endSecond: number, // Testin bittiği an (tamamlanan testte son cevabın geldiği saniye)
  stopped: boolean
): AnalysisEvent[] {
  const events: AnalysisEvent[] = [];
  if (seconds.length === 0) return events;

  events.push({ type: "start", second: 0, rps: Math.round(seconds[0].targetRps) });

  // Kademe geçişleri
  if (isStepped) {
    for (const range of ranges.slice(1)) {
      if (range.from >= endSecond) break;
      const step = steps.find((s) => s.index === range.index);
      if (step) events.push({ type: "step", second: range.from, index: range.index, rps: step.targetRps });
    }
  }

  // Gecikme artışı (sağlıklı seviye varsa ona göre, yoksa "baştan zorlandı")
  const limits = latencyLimits(baseline);
  if (limits) {
    const i = firstSustained(seconds, (s) => {
      const p95 = percentile(s.latencies, 0.95);
      return p95 !== null && p95 > limits.borderline;
    });
    if (i >= 0) {
      events.push({
        type: "latencyRise",
        second: seconds[i].index,
        from: baseline.p95!,
        to: percentile(seconds[i].latencies, 0.95)!,
      });
    }
  } else {
    events.push({ type: "unhealthyFromStart", second: 0 });
  }

  // Kuyruk birikmesi (kademe ya da sabit test içinde gecikme sürekli artıyor)
  for (const step of steps) {
    if (step.trend) {
      const middle = step.fromSecond + Math.floor((step.toSecond - step.fromSecond) / 2);
      events.push({ type: "queueRising", second: middle, from: step.trend.from, to: step.trend.to });
    }
  }

  // Cevap tarafı hataların başlaması ve zirvesi
  const errorsAt = firstSustained(seconds, hasResponseErrors);
  if (errorsAt >= 0) {
    events.push({ type: "errorsStart", second: seconds[errorsAt].index, codes: responseErrorCodes(seconds[errorsAt]) });

    let peak = seconds[errorsAt];
    for (const s of seconds) if (responseErrorRateOf(s) > responseErrorRateOf(peak)) peak = s;
    if (peak.index !== seconds[errorsAt].index && responseErrorRateOf(peak) >= T.errorRate.strained) {
      events.push({ type: "errorPeak", second: peak.index, rate: responseErrorRateOf(peak) });
    }
  }

  // Bağlantı kopması ve toparlanma
  const lostAt = firstSustained(seconds, isDisconnected);
  if (lostAt >= 0) {
    events.push({ type: "connectionLost", second: seconds[lostAt].index });
    const recoveredAt = firstSustained(seconds, isRecovered, lostAt + T.sustainedSeconds);
    if (recoveredAt >= 0) events.push({ type: "recovered", second: seconds[recoveredAt].index });
  }

  events.push({ type: stopped ? "stopped" : "end", second: endSecond });

  // Zamana göre sırala (aynı saniyedekiler eklendikleri sırada kalır)
  return events
    .map((e, order) => ({ e, order }))
    .sort((a, b) => a.e.second - b.e.second || a.order - b.order)
    .map(({ e }) => e);
}