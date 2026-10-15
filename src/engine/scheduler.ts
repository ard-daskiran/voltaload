export type TickCallback = () => void;

export interface LoadProfile {
  type: "CONSTANT" | "STEPPED";
  stepCount?: number;
}

const CONSTANT_PROFILE: LoadProfile = { type: "CONSTANT" };

// Small margin against floating-point errors (e.g. with 20/3 s steps)
const EPSILON = 1e-9;

// RPS of a step (counted from 0): rounded to a whole number, same as the value shown in the form. At least 1.
function stepRps(stepIndex: number, targetRps: number, steps: number): number {
  return Math.max(1, Math.round((targetRps * (stepIndex + 1)) / steps));
}

// Target RPS at a given moment (second) of the test
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

// "Request volume" from the test start up to the given moment: the area under the RPS curve. May not be a whole number.
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

// Total request count of the test
function totalRequests(targetRps: number, durationSeconds: number, profile: LoadProfile): number {
  return Math.ceil(requestVolumeAt(durationSeconds, targetRps, durationSeconds, profile) - EPSILON);
}

// Requests are sent at equal intervals, the FIRST AT TIME 0: request k goes out when the request volume reaches k.
// (5 RPS → 0 · 0.2 · 0.4 · ... Each second gets exactly 5 requests.)

// Number of requests that should have been sent up to the given moment (inclusive). Used by the scheduler.
function requestsDueBy(seconds: number, targetRps: number, durationSeconds: number, profile: LoadProfile): number {
  const total = totalRequests(targetRps, durationSeconds, profile);
  if (seconds >= durationSeconds) return total;
  return Math.min(total, Math.floor(requestVolumeAt(seconds, targetRps, durationSeconds, profile) + EPSILON) + 1);
}

// Number of requests that should have been sent BEFORE the given moment
function requestsBefore(seconds: number, targetRps: number, durationSeconds: number, profile: LoadProfile): number {
  if (seconds <= 0) return 0;
  const total = totalRequests(targetRps, durationSeconds, profile);
  if (seconds >= durationSeconds) return total;
  return Math.min(total, Math.ceil(requestVolumeAt(seconds, targetRps, durationSeconds, profile) - EPSILON));
}

// Number of requests that should be sent between two moments ([from, to)). The analysis gets each second's target from here
// (same calculation as the scheduler: correct even when a step changes mid-second).
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

// Note: this loop keeps one CPU core busy for the duration of the test.
// A sleeping (setTimeout-based) version was tried, but on Windows it was measured
// to hurt measurement accuracy (~52ms → ~70ms). Accuracy was preferred.
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

      // Time's up: send any requests missed at the last moment, then finish
      if (nowMs >= durationMs) {
        while (ticksSoFar < total) {
          onTick();
          ticksSoFar++;
        }
        resolve();
        return;
      }

      // If we've fallen behind, catch up immediately (the first request goes out at time 0)
      const expected = requestsDueBy(nowMs / 1000, targetRps, durationSeconds, profile);

      while (ticksSoFar < expected) {
        onTick();
        ticksSoFar++;
      }

      // Yield to the event loop (so incoming responses get processed), then check again right away
      setImmediate(loop);
    }

    loop();
  });
}