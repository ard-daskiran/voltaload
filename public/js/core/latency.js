// Latency levels. The history list, step table and report use the same limits.
// Limits live here; colors live in each place (dark theme / white paper differ).

const SLOW_MS = 500;
const CRITICAL_MS = 1000;

// "none" (no data) · "normal" · "slow" (500 ms and above) · "critical" (1 second and above)
export function latencyLevel(ms) {
    if (ms === null || ms === undefined) return "none";
    if (ms >= CRITICAL_MS) return "critical";
    if (ms >= SLOW_MS) return "slow";
    return "normal";
}