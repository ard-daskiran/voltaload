// The chart's visual constants: colors, line order, point sizes, axis settings.

// Order of the datasets (same as the data-series values in the legend row)
export const SERIES = { AVG: 0, P95: 1, P99: 2, SUCCESS_RPS: 3, SENT_RPS: 4, CONNECTION: 5 };

export const CHART_COLORS = {
    avg: "#f4c21a",
    p95: "#64d8d7",
    p99: "#c4b5fd",
    successRps: "#b8ad96",
    sentRps: "#e1e2eb",
    error: "#ff5555",
    errorFill: "rgba(255, 85, 85, 0.14)",
    muted: "#9a9079",
    tick: "#9a9079",
    grid: "rgba(48, 54, 61, 0.6)",
    background: "#0b0e14",
};

// Whole-second points: small dot with a dark ring, grows on hover
export const SECOND_DOT = { radius: 3.5, hoverRadius: 6, ring: 1.5 };

// Latency axis: ceiling = highest value × 1.2. It only grows, sliding smoothly as it does.
// Upper limit 2750: latency can't exceed 2500 (timeout), so the 2500 line doesn't stick to the ceiling.
export const Y_AXIS = { min: 100, cap: 2750, headroom: 1.2, animationMs: 500 };

export const MONO_FONT = { family: "'IBM Plex Mono', monospace", size: 10 };