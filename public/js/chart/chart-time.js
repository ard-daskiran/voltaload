// Time helpers: snapping to windows, whole-second checks, axis labels.

import { formatNumber } from "../core/i18n.js";

// The window length comes from the server (config.ts → LIVE_WINDOW_MS). This is only the default until the first batch arrives.
export const DEFAULT_WINDOW_SECONDS = 0.2;

// Cleans up small drifts in decimal math (0.30000000004 → 0.3)
export function roundTime(value) {
    return Number(value.toFixed(3));
}

// Snap the time to a multiple of the window length (with 0.2 s: 0 · 0.2 · 0.4 ...)
export function snapToWindow(seconds, windowSeconds) {
    return roundTime(Math.round(seconds / windowSeconds) * windowSeconds);
}

export function isWholeSecond(x) {
    return x !== undefined && x !== null && Math.abs(x - Math.round(x)) < 1e-6;
}

// Is it a whole-second point? Excluding 0 (no second has finished yet at 0)
export function isSecondMark(x) {
    return isWholeSecond(x) && x > 0;
}

// Convert the time to a map key ("7.4")
export function xKey(x) {
    return x.toFixed(1);
}

// Time axis label:
//   whole second      → "1s", "2s"
//   in-between value that lands on a point (a multiple of the window length) → "1.2s", "1.4s"  (visible only when zoomed in)
//   value that lands on no point (like 1.25) → empty
// This way the same label is never written twice.
export function formatTimeTick(value, windowSeconds) {
    if (isWholeSecond(value)) return `${formatNumber(Math.round(value), 0)}s`;

    const steps = value / windowSeconds;
    if (Math.abs(steps - Math.round(steps)) < 1e-6) return `${formatNumber(value, 1)}s`;

    return "";
}