export type TickCallback = () => void;

export interface LoadProfile {
  type: "CONSTANT" | "STEPPED";
  stepCount?: number;
}

const CONSTANT_PROFILE: LoadProfile = { type: "CONSTANT" };

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
  const stepIndex = Math.min(steps - 1, Math.floor(seconds / stepDuration));
  return (targetRps * (stepIndex + 1)) / steps;
}

// Testin belirli bir anına (saniye) kadar toplamda atılmış olması gereken istek sayısı
function expectedTicksAt(
  seconds: number,
  targetRps: number,
  durationSeconds: number,
  profile: LoadProfile = CONSTANT_PROFILE
): number {
  if (profile.type === "CONSTANT") return seconds * targetRps;

  const steps = Math.max(1, profile.stepCount ?? 1);
  const stepDuration = durationSeconds / steps;
  let total = 0;

  for (let i = 0; i < steps; i++) {
    const stepStart = i * stepDuration;
    if (seconds <= stepStart) break;

    const stepEnd = Math.min(seconds, stepStart + stepDuration);
    const stepRps = (targetRps * (i + 1)) / steps;
    total += (stepEnd - stepStart) * stepRps;
  }

  return total;
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
  const totalTicks = Math.floor(expectedTicksAt(durationSeconds, targetRps, durationSeconds, profile));

  let ticksSoFar = 0;

  function elapsedMs(): number {
    return Number(process.hrtime.bigint() - startTime) / 1_000_000;
  }

  return new Promise((resolve) => {
    function loop() {
      const nowMs = elapsedMs();

      // Süre doldu: son anda kaçırılan istekleri de at, bitir
      if (nowMs >= durationMs) {
        while (ticksSoFar < totalTicks) {
          onTick();
          ticksSoFar++;
        }
        resolve();
        return;
      }

      // Geride kaldıysak açığı hemen kapat
      const expected = Math.floor(expectedTicksAt(nowMs / 1000, targetRps, durationSeconds, profile));

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