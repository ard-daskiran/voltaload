// Overall result: the gauge's needle (state) and the big number (estimated safe capacity).

import type { HealthState, Reason } from "./classify.js";
import type { StepResult } from "./steps.js";
import type { Baseline } from "./baseline.js";

type Capacity =
  | { kind: "approx"; rps: number; breakAt: number } // ~100 RPS (broke down at 150)
  | { kind: "atLeast"; rps: number } // ≥ 200 RPS (no limit seen)
  | { kind: "below"; rps: number }; // < 50 RPS (broke down even at the first load)

// The connection was lost but the server was healthy before that. Capacity is still computed conservatively
// (it may have collapsed due to the load); only the sentence states clearly what happened.
export interface Outage {
  second: number; // Second the connection was lost
  rps: number; // Load handled up to that point
}

export interface Verdict {
  state: HealthState; // State at the highest load
  capacity: Capacity;
  slowButStable: boolean; // No errors, full RPS, no rise; just slow from the start
  outage: Outage | null;
}

// A step counts toward capacity if it's healthy or "borderline" only because of latency.
// If it's borderline but returning errors, falling behind or its queue is growing, it counts as the breaking point.
// (So small fluctuations right at the server's limit don't pull capacity down by a step.)
const ACCEPTABLE_REASONS: Reason[] = ["latencyRelative", "latencyAbsolute"];

function isAcceptable(step: StepResult): boolean {
  if (step.state === "HEALTHY") return true;
  return step.state === "BORDERLINE" && step.reasons.every((r) => ACCEPTABLE_REASONS.includes(r));
}

export function buildVerdict(steps: StepResult[], baseline: Baseline, outage: Outage | null): Verdict {
  const peak = steps[steps.length - 1];

  // If the only cause is the fixed latency limit: the request itself is slow, not the load
  const slowButStable =
    !baseline.valid &&
    peak.state !== "HEALTHY" &&
    steps.every((s) => s.reasons.every((r) => r === "latencyAbsolute"));

  // Number of consecutive steps from the start that count toward capacity
  let acceptableCount = 0;
  while (acceptableCount < steps.length && isAcceptable(steps[acceptableCount])) acceptableCount++;

  let capacity: Capacity;
  if (slowButStable || acceptableCount === steps.length) {
    // If it's slow but stable, the load was still handled: no errors, full RPS, no rise. The problem isn't the load,
    // and a lower load won't make it faster. Capacity is "≥ tested load"; the state still follows latency.
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

  return { state: peak.state, capacity, slowButStable, outage };
}