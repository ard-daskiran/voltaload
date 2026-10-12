export type TickCallback = () => void;

export interface LoadProfile {
  type: "CONSTANT" | "STEPPED";
  stepCount?: number;
}

const CONSTANT_PROFILE: LoadProfile = { type: "CONSTANT" };

// Kayan nokta hatalarına karşı küçük pay (örneğin 20/3 sn'lik kademelerde)
const EPSILON = 1e-9;

// Kademenin (0'dan sayılır) RPS'i: tam sayıya yuvarlanır, formda görünen değerle aynı. En az 1.
function stepRps(stepIndex: number, targetRps: number, steps: number): number {
  return Math.max(1, Math.round((targetRps * (stepIndex + 1)) / steps));
}

// Testin belirli bir anında (saniye) hedeflenen RPS
export function targetRpsAt(
  seconds: number,
  targetRps: number,
  durationSeconds: number,
  profile: LoadProfile = CONSTANT_PROFILE
): number {
  if (profile.type === "CONSTANT") return targetRps;

  const steps = Math.max(1, profile.stepCount ?? 1);
  const stepDuration = durationSeconds / steps;
  const stepIndex = Math.min(steps - 1, Math.max(0, Math.floor(seconds / stepDuration)));
  return stepRps(stepIndex, targetRps, steps);
}

// Testin başından verilen ana kadarki "istek miktarı": RPS eğrisinin altındaki alan. Tam sayı olmayabilir.
function requestVolumeAt(
  seconds: number,
  targetRps: number,
  durationSeconds: number,
  profile: LoadProfile
): number {
  const t = Math.min(Math.max(0, seconds), durationSeconds);
  if (profile.type === "CONSTANT") return t * targetRps;

  const steps = Math.max(1, profile.stepCount ?? 1);
  const stepDuration = durationSeconds / steps;
  let total = 0;

  for (let i = 0; i < steps; i++) {
    const stepStart = i * stepDuration;
    if (t <= stepStart) break;

    const stepEnd = Math.min(t, stepStart + stepDuration);
    total += (stepEnd - stepStart) * stepRps(i, targetRps, steps);
  }

  return total;
}

// Testin toplam istek sayısı
function totalRequests(targetRps: number, durationSeconds: number, profile: LoadProfile): number {
  return Math.ceil(requestVolumeAt(durationSeconds, targetRps, durationSeconds, profile) - EPSILON);
}

// İstekler eşit aralıklarla gönderilir, İLKİ 0. ANDA: k. istek, istek miktarının k'ya ulaştığı anda gider.
// (5 RPS → 0 · 0,2 · 0,4 · ... Her saniyeye tam 5 istek düşer.)

// Verilen ana kadar (o an dahil) gönderilmiş olması gereken istek sayısı. Zamanlayıcı kullanır.
function requestsDueBy(seconds: number, targetRps: number, durationSeconds: number, profile: LoadProfile): number {
  const total = totalRequests(targetRps, durationSeconds, profile);
  if (seconds >= durationSeconds) return total;
  return Math.min(total, Math.floor(requestVolumeAt(seconds, targetRps, durationSeconds, profile) + EPSILON) + 1);
}

// Verilen andan ÖNCE gönderilmiş olması gereken istek sayısı
function requestsBefore(seconds: number, targetRps: number, durationSeconds: number, profile: LoadProfile): number {
  if (seconds <= 0) return 0;
  const total = totalRequests(targetRps, durationSeconds, profile);
  if (seconds >= durationSeconds) return total;
  return Math.min(total, Math.ceil(requestVolumeAt(seconds, targetRps, durationSeconds, profile) - EPSILON));
}

// İki an arasında ([from, to)) gönderilmesi gereken istek sayısı. Analiz, her saniyenin hedefini buradan alır
// (zamanlayıcıyla aynı hesap: kademe saniyenin ortasında değişse de doğru).
export function requestsBetween(
  from: number,
  to: number,
  targetRps: number,
  durationSeconds: number,
  profile: LoadProfile = CONSTANT_PROFILE
): number {
  return (
    requestsBefore(to, targetRps, durationSeconds, profile) - requestsBefore(from, targetRps, durationSeconds, profile)
  );
}

// Not: Bu döngü test süresince bir CPU çekirdeğini meşgul eder.
// Uyuyan (setTimeout tabanlı) bir sürüm denendi ancak Windows'ta ölçüm
// doğruluğunu bozduğu ölçüldü (~52ms → ~70ms). Doğruluk tercih edildi.
export function runScheduledLoop(
  targetRps: number,
  durationSeconds: number,
  onTick: TickCallback,
  profile: LoadProfile = CONSTANT_PROFILE
): Promise<void> {
  const startTime = process.hrtime.bigint();
  const durationMs = durationSeconds * 1000;
  const total = totalRequests(targetRps, durationSeconds, profile);

  let ticksSoFar = 0;

  function elapsedMs(): number {
    return Number(process.hrtime.bigint() - startTime) / 1_000_000;
  }

  return new Promise((resolve) => {
    function loop() {
      const nowMs = elapsedMs();

      // Süre doldu: son anda kaçırılan istekleri de at, bitir
      if (nowMs >= durationMs) {
        while (ticksSoFar < total) {
          onTick();
          ticksSoFar++;
        }
        resolve();
        return;
      }

      // Geride kaldıysak açığı hemen kapat (ilk istek 0. anda gider)
      const expected = requestsDueBy(nowMs / 1000, targetRps, durationSeconds, profile);

      while (ticksSoFar < expected) {
        onTick();
        ticksSoFar++;
      }

      // Event loop'a sıra ver (gelen cevaplar işlensin), sonra hemen tekrar kontrol et
      setImmediate(loop);
    }

    loop();
  });
}