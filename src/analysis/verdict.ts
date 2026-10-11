// Genel sonuç: göstergedeki ok (durum) ve büyük sayı (tahmini güvenli kapasite).

import type { HealthState, Reason } from "./classify.js";
import type { StepResult } from "./steps.js";
import type { Baseline } from "./baseline.js";

type Capacity =
  | { kind: "approx"; rps: number; breakAt: number } // ~100 RPS (150'de bozuldu)
  | { kind: "atLeast"; rps: number } // ≥ 200 RPS (sınır görülmedi)
  | { kind: "below"; rps: number }; // < 50 RPS (ilk yükte bile bozuldu)

// Bağlantı koptu ama öncesinde sunucu sağlıklıydı. Kapasite yine temkinli hesaplanır
// (yük yüzünden çökmüş olabilir), sadece cümle ne olduğunu açıkça anlatır.
export interface Outage {
  second: number; // Bağlantının koptuğu saniye
  rps: number; // O ana kadar karşılanan yük
}

export interface Verdict {
  state: HealthState; // En yüksek yükteki durum
  capacity: Capacity;
  slowButStable: boolean; // Hata yok, RPS tam, artış yok; sadece baştan beri yavaş
  outage: Outage | null;
}

// Kapasiteye sayılan kademe: sağlıklı ya da sadece gecikme yüzünden "sınırda".
// Sınırda ama hata veriyor, yetişemiyor ya da kuyruğu büyüyorsa kırılma noktası sayılır.
// (Sunucunun tam sınırındaki küçük dalgalanmalar kapasiteyi bir kademe aşağı çekmesin.)
const ACCEPTABLE_REASONS: Reason[] = ["latencyRelative", "latencyAbsolute"];

function isAcceptable(step: StepResult): boolean {
  if (step.state === "HEALTHY") return true;
  return step.state === "BORDERLINE" && step.reasons.every((r) => ACCEPTABLE_REASONS.includes(r));
}

export function buildVerdict(steps: StepResult[], baseline: Baseline, outage: Outage | null): Verdict {
  const peak = steps[steps.length - 1];

  // Baştan itibaren üst üste kapasiteye sayılan kademe sayısı
  let acceptableCount = 0;
  while (acceptableCount < steps.length && isAcceptable(steps[acceptableCount])) acceptableCount++;

  let capacity: Capacity;
  if (acceptableCount === steps.length) {
    capacity = { kind: "atLeast", rps: peak.targetRps };
  } else if (acceptableCount === 0) {
    capacity = { kind: "below", rps: steps[0].targetRps };
  } else {
    capacity = {
      kind: "approx",
      rps: steps[acceptableCount - 1].targetRps,
      breakAt: steps[acceptableCount].targetRps,
    };
  }

  // Sorunun tek sebebi sabit gecikme sınırıysa: yük değil, isteğin kendisi yavaş
  const slowButStable =
    !baseline.valid &&
    peak.state !== "HEALTHY" &&
    steps.every((s) => s.reasons.every((r) => r === "latencyAbsolute"));

  return { state: peak.state, capacity, slowButStable, outage };
}