// Live chart: setup, adding windows, second points, finishing.
// Visual constants, animation, plugins, tooltip and legend row are in separate files.

import { t, formatNumber } from "../core/i18n.js";
import { statusCategory } from "../status/status-info.js";
import { SERIES, CHART_COLORS, SECOND_DOT, Y_AXIS, MONO_FONT } from "./chart-theme.js";
import { DEFAULT_WINDOW_SECONDS, roundTime, snapToWindow, isSecondMark, xKey, formatTimeTick } from "./chart-time.js";
import { createChartAnimator } from "./chart-animation.js";
import { glowPlugin, crosshairPlugin, createRevealPlugin, avgFill } from "./chart-plugins.js";
import { createChartTooltip } from "./chart-tooltip.js";
import { bindLegend, updateLegendButtons } from "./chart-legend.js";


// --- State ---
let liveChart = null;
let tooltip = null;
let windowSeconds = DEFAULT_WINDOW_SECONDS;
let windowMeta = []; // Details of each window, in the same order as the latency datasets
let windowIndexByX = new Map(); // "7.4" → its position in windowMeta
let secondTotals = new Map(); // finished second (3) → request counts for 2–3 s
let lastLatency = null; // Last real average (the connection error line continues from this level)
let inOutage = false;
let initialMaxSeconds = 10;
let userZoomed = false;
let lastX = 0;

// Lines the user toggled: remembered while the page stays open; a new test's chart is built with them.
// Untouched lines keep their default (RPS lines are off for constant load, on for stepped).
const visibilityChoice = new Map(); // line → is it visible
let currentDefaults = null; // default visibilities of the current chart

const animator = createChartAnimator();
const revealPlugin = createRevealPlugin(() => animator.revealedX());

// The tooltip gets a window's info at a given time from here
function lookup(x) {
    const index = windowIndexByX.get(xKey(x));
    return {
        meta: index !== undefined ? windowMeta[index] : null,
        totals: isSecondMark(x) ? secondTotals.get(Math.round(x)) ?? null : null,
    };
}

// Appearance of whole-second points (shared by the average and connection error lines)
function secondDotOptions(shouldShow, colorFor) {
    return {
        pointRadius: (ctx) => (shouldShow(ctx) ? SECOND_DOT.radius : 0),
        pointHoverRadius: (ctx) => (shouldShow(ctx) ? SECOND_DOT.hoverRadius : 0),
        pointBackgroundColor: colorFor,
        pointHoverBackgroundColor: colorFor,
        pointBorderColor: CHART_COLORS.background,
        pointHoverBorderColor: CHART_COLORS.background,
        pointBorderWidth: SECOND_DOT.ring,
        pointHoverBorderWidth: SECOND_DOT.ring,
    };
}

// Effect of a new point on the horizontal axis and zoom limits
function extendRange(x) {
    liveChart.options.plugins.zoom.limits.x.max = Math.max(initialMaxSeconds, x);
    if (!userZoomed && x > liveChart.options.scales.x.max) {
        liveChart.options.scales.x.max = x;
    }
}

// --- Public functions ---

export function createChart(durationSeconds = 10, profileType = "CONSTANT") {
    const canvas = document.getElementById("chart");

    // Before the old chart is destroyed: remember the lines the user left different from the default
    if (liveChart && currentDefaults) {
        for (const [series, visibleByDefault] of currentDefaults) {
            const visible = liveChart.isDatasetVisible(series);
            if (visible !== visibleByDefault || visibilityChoice.has(series)) visibilityChoice.set(series, visible);
        }
    }

    if (liveChart) liveChart.destroy();

    if (!tooltip) {
        tooltip = createChartTooltip({ element: document.getElementById("chart-tooltip"), lookup });
    }
    tooltip.reset();
    animator.reset();

    windowSeconds = DEFAULT_WINDOW_SECONDS;
    windowMeta = [];
    windowIndexByX = new Map();
    secondTotals = new Map();
    lastLatency = null;
    inOutage = false;
    userZoomed = false;
    lastX = 0;
    initialMaxSeconds = Math.min(durationSeconds, 10);

    // In a stepped test the RPS lines are on by default (the staircase and successful RPS are the main view)
    const showRps = profileType === "STEPPED";
    currentDefaults = new Map([
        [SERIES.AVG, true],
        [SERIES.P95, true],
        [SERIES.P99, true],
        [SERIES.SUCCESS_RPS, showRps],
        [SERIES.SENT_RPS, showRps],
        [SERIES.CONNECTION, true],
    ]);

    // The user's choice if they made one, otherwise the default
    const hiddenOf = (series) => !(visibilityChoice.get(series) ?? currentDefaults.get(series));

    const line = (label, color, extra = {}) => ({
        label,
        data: [],
        borderColor: color,
        backgroundColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        // A smooth line that doesn't overshoot the measured points
        cubicInterpolationMode: "monotone",
        fill: false,
        spanGaps: false,
        ...extra,
    });

    liveChart = new Chart(canvas, {
        type: "line",
        data: {
            datasets: [
                line(t("chart.series.avg"), CHART_COLORS.avg, {
                    hidden: hiddenOf(SERIES.AVG),
                    borderWidth: 2,
                    fill: "origin",
                    backgroundColor: avgFill,
                    // Points only at whole seconds (the request count of the second ending there is read)
                    ...secondDotOptions(
                        (ctx) => isSecondMark(ctx.raw?.x),
                        (ctx) => (windowMeta[ctx.dataIndex]?.hasError ? CHART_COLORS.error : CHART_COLORS.avg)
                    ),
                    // The segment leading to a window with errors, and the area under it, are red
                    segment: {
                        borderColor: (ctx) => (windowMeta[ctx.p1DataIndex]?.hasError ? CHART_COLORS.error : undefined),
                        backgroundColor: (ctx) => (windowMeta[ctx.p1DataIndex]?.hasError ? CHART_COLORS.errorFill : undefined),
                    },
                }),
                line(t("chart.series.p95"), CHART_COLORS.p95, { hidden: hiddenOf(SERIES.P95) }),
                line(t("chart.series.p99"), CHART_COLORS.p99, { hidden: hiddenOf(SERIES.P99) }),
                // Successful RPS: points only at whole seconds (each one is that whole second)
                line(t("chart.series.completedRps"), CHART_COLORS.successRps, {
                    yAxisID: "y1",
                    hidden: hiddenOf(SERIES.SUCCESS_RPS),
                    pointRadius: 2,
                    spanGaps: true,
                }),
                line(t("chart.series.sentRps"), CHART_COLORS.sentRps, {
                    yAxisID: "y1",
                    hidden: hiddenOf(SERIES.SENT_RPS),
                    borderDash: [5, 4],
                    borderWidth: 1,
                    stepped: true,
                    pointHoverRadius: 0,
                }),
                line(t("chart.connectionError"), CHART_COLORS.error, {
                    borderWidth: 2,
                    cubicInterpolationMode: "default",
                    // At whole seconds with connection errors, the point sits on this line
                    ...secondDotOptions(
                        (ctx) => isSecondMark(ctx.raw?.x) && Boolean(windowMeta[ctx.dataIndex]?.connectionOnly),
                        () => CHART_COLORS.error
                    ),
                }),
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            parsing: false,
            normalized: true,
            // Points aren't animated: the curtain and axis loop create the sense of flow
            animation: false,
            // Anywhere on the chart: the moment horizontally closest to the mouse
            interaction: { mode: "nearest", axis: "x", intersect: false },
            onHover: (event, elements, chart) => tooltip.handleHover(event, elements, chart),
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false, external: (context) => tooltip.render(context) },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: "x",
                        // Auto-scroll stops the moment the user STARTS interacting with the chart (no jumping)
                        onPanStart: () => {
                            userZoomed = true;
                            return true;
                        },
                    },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: "x",
                        onZoomStart: () => {
                            userZoomed = true;
                            return true;
                        },
                    },
                    // Zooming out and panning are limited to the range that has data (max grows with each new point)
                    limits: { x: { min: 0, max: initialMaxSeconds, minRange: 1 } },
                },
            },
            scales: {
                x: {
                    type: "linear",
                    min: 0,
                    max: initialMaxSeconds,
                    ticks: { color: CHART_COLORS.tick, font: MONO_FONT, callback: (v) => formatTimeTick(v, windowSeconds) },
                    grid: { display: false },
                },
                y: {
                    beginAtZero: true,
                    // The animation loop manages the ceiling; Chart.js doesn't change it on its own
                    max: Y_AXIS.min,
                    ticks: {
                        color: CHART_COLORS.tick,
                        font: MONO_FONT,
                        // Don't show the constantly changing ceiling itself (like 263) as a label, only round values
                        includeBounds: false,
                        callback: (v) => `${formatNumber(Math.round(v))}ms`,
                    },
                    grid: { color: CHART_COLORS.grid },
                },
                y1: {
                    position: "right",
                    beginAtZero: true,
                    // The axis is shown only while one of the RPS lines is visible
                    display: "auto",
                    ticks: { color: CHART_COLORS.successRps, font: MONO_FONT, callback: (v) => `${formatNumber(Math.round(v))} r/s` },
                    grid: { display: false },
                },
            },
        },
        // Order matters: the curtain opens and closes first, so the dashed line (crosshair) stays outside the curtain
        plugins: [revealPlugin, glowPlugin, crosshairPlugin],
    });

    animator.attach(liveChart);
    updateLegendButtons(liveChart);
}

// Adds a window to the chart. The window is placed at the moment it STARTS (0–0.2 → 0).
// Returns the time the point was placed at. The live stream and reconnection use the same function.
export function addWindow(d) {
    if (!liveChart) return null;

    if (d.windowSeconds) windowSeconds = d.windowSeconds;

    const end = snapToWindow(d.elapsedSeconds, windowSeconds);
    let x = roundTime(end - windowSeconds);
    // If small timer jitter snaps two windows to the same point, move the later one a step forward
    if (windowMeta.length > 0 && x <= lastX) x = roundTime(lastX + windowSeconds);
    if (x < 0) x = 0;


    // Empty window (no responses at all in that 0.2 s; normal at low RPS): no point is added to the latency lines,
    // the lines connect seamlessly from the previous point to the next. The chart still advances smoothly.
    // (A connection error is different: there are requests but no latency; shown below with a red line.)
    if (d.requestCount === 0) {
        liveChart.data.datasets[SERIES.SENT_RPS].data.push({ x, y: d.targetRps });
        lastX = x;
        extendRange(x);
        liveChart.update("none");
        animator.revealTo(x, windowSeconds * 1000, windowMeta.length > 0);
        return x;
    }

    const hasLatency = d.avgResponseTime !== null;
    const index = windowMeta.length;

    windowMeta.push({
        x,
        avg: d.avgResponseTime,
        p95: d.p95ResponseTime,
        p99: d.p99ResponseTime,
        hasError: d.errorCount > 0,
        errorCodes: Object.keys(d.statusCounts).filter((code) => statusCategory(code) === "serverError"),
        connectionOnly: !hasLatency,
    });
    windowIndexByX.set(xKey(x), index);

    const ds = liveChart.data.datasets;
    ds[SERIES.AVG].data.push({ x, y: hasLatency ? d.avgResponseTime : null });
    ds[SERIES.P95].data.push({ x, y: d.p95ResponseTime });
    ds[SERIES.P99].data.push({ x, y: d.p99ResponseTime });
    ds[SERIES.SENT_RPS].data.push({ x, y: d.targetRps });

    // Connection error line: continues flat from the last real value, and joins the new value when the connection returns
    const conn = ds[SERIES.CONNECTION].data;

    if (!hasLatency) {
        const level = lastLatency ?? 0;
        // If the outage just started, the red line should start from the previous (last real) point
        if (!inOutage && index > 0 && lastLatency !== null) {
            conn[index - 1] = { x: conn[index - 1].x, y: level };
        }
        conn.push({ x, y: level });
        inOutage = true;
    } else {
        conn.push({ x, y: inOutage ? d.avgResponseTime : null });
        inOutage = false;
        lastLatency = d.avgResponseTime;
    }

    lastX = x;
    extendRange(x);
    animator.growYAxis(Math.max(d.avgResponseTime ?? 0, d.p95ResponseTime ?? 0, d.p99ResponseTime ?? 0));
    liveChart.options.scales.y.max = animator.currentYAxisMax();
    liveChart.update("none");
    animator.revealTo(x, windowSeconds * 1000, windowMeta.length > 1);
    return x;
}

// Records the request counts of a finished second. The point is placed where the second ENDS (0–1 → 1).
// It's drawn on screen together with the next window.
export function addSecondPoint(endSecond, totals) {
    if (!liveChart) return;

    secondTotals.set(endSecond, { ...totals, second: endSecond });
    liveChart.data.datasets[SERIES.SUCCESS_RPS].data.push({ x: endSecond, y: totals.success });
}

// When the test ends, extends the line to the end of the last window (a 10 s test ends at 10, not 9.8).
// Not a new measurement: the same values as the last window, just marking the window's end.
export function closeChart() {
    if (!liveChart || windowMeta.length === 0) return;

    const last = windowMeta[windowMeta.length - 1];
    const endX = roundTime(last.x + windowSeconds);
    // If empty windows came after the last non-empty one, the chart has already advanced that far
    if (windowIndexByX.has(xKey(endX)) || endX <= lastX) return;

    const index = windowMeta.length;
    windowMeta.push({ ...last, x: endX });
    windowIndexByX.set(xKey(endX), index);

    const ds = liveChart.data.datasets;
    for (const series of [SERIES.AVG, SERIES.P95, SERIES.P99, SERIES.SENT_RPS, SERIES.CONNECTION]) {
        const data = ds[series].data;
        const previous = data[data.length - 1];
        data.push({ x: endX, y: previous?.y ?? null });
    }

    lastX = endX;
    extendRange(endX);
    liveChart.update("none");
    animator.revealTo(endX, windowSeconds * 1000, true);
}

export function resetChartZoom() {
    if (!liveChart) return;

    userZoomed = false;
    liveChart.options.scales.x.min = 0;
    liveChart.options.scales.x.max = Math.max(initialMaxSeconds, lastX);
    liveChart.update("none");
}

// Wire up the legend row's buttons (once when the page opens)
export function initLegend() {
    bindLegend(() => liveChart);
}