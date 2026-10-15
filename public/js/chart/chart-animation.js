// The chart's animation loop: the curtain and the axis growing smoothly.
// The points never move. Two things create the sense of flow:
//   1) Curtain: the right edge of the visible area moves from the previous point toward the new one.
//   2) Axis: when the ceiling grows, it slides smoothly to its new value.
// Both run in a single loop without interfering with each other.

import { Y_AXIS } from "./chart-theme.js";

export function createChartAnimator() {
    let chart = null;
    let frame = null;

    const reveal = { from: 0, to: 0, start: 0, duration: 0 };
    const yAxis = { from: Y_AXIS.min, to: Y_AXIS.min, start: 0 };

    // Up to what time the curtain is currently open (in seconds)
    function revealedX() {
        if (reveal.duration <= 0) return reveal.to;
        const progress = Math.min(1, (performance.now() - reveal.start) / reveal.duration);
        return reveal.from + (reveal.to - reveal.from) * progress;
    }

    function isRevealing() {
        return performance.now() - reveal.start < reveal.duration;
    }

    // The axis's current ceiling (slows down toward the end of the slide)
    function currentYAxisMax() {
        const progress = Math.min(1, (performance.now() - yAxis.start) / Y_AXIS.animationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        return yAxis.from + (yAxis.to - yAxis.from) * eased;
    }

    function isYAxisMoving() {
        return performance.now() - yAxis.start < Y_AXIS.animationMs;
    }

    function requestFrame() {
        if (frame === null) frame = requestAnimationFrame(animateFrame);
    }

    function animateFrame() {
        frame = null;
        if (!chart) return;

        const axisMoving = isYAxisMoving();
        const targetMax = currentYAxisMax();

        if (axisMoving || chart.options.scales.y.max !== targetMax) {
            // The axis is changing: have the scale recomputed
            chart.options.scales.y.max = targetMax;
            chart.update("none");
        } else {
            // Only the curtain is moving: redrawing is enough
            chart.draw();
        }

        if (axisMoving || isRevealing()) requestFrame();
    }

    // Attached when a new chart is created
    function attach(newChart) {
        chart = newChart;
    }

    function reset() {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        chart = null;

        reveal.from = 0;
        reveal.to = 0;
        reveal.start = 0;
        reveal.duration = 0;

        yAxis.from = Y_AXIS.min;
        yAxis.to = Y_AXIS.min;
        yAxis.start = 0;
    }

    // Open the curtain toward the new point.
    // continueFromCurrent: if a new one arrives before the previous opening finishes, continue from where it is (no jump)
    function revealTo(toX, durationMs, continueFromCurrent) {
        reveal.from = continueFromCurrent ? revealedX() : toX;
        reveal.to = toX;
        reveal.start = performance.now();
        reveal.duration = durationMs;
        requestFrame();
    }

    // If the highest value exceeds the ceiling, grow the ceiling smoothly. Never shrink it.
    function growYAxis(peak) {
        const target = Math.min(Y_AXIS.cap, Math.max(Y_AXIS.min, Math.ceil((peak * Y_AXIS.headroom) / 10) * 10));
        if (target <= yAxis.to) return;

        yAxis.from = currentYAxisMax();
        yAxis.to = target;
        yAxis.start = performance.now();
        requestFrame();
    }

    return { attach, reset, revealTo, revealedX, growYAxis, currentYAxisMax };
}