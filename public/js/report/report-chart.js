// Raporun grafiği: beyaz zemin, etkileşimsiz, animasyonsuz.
// Ortalama, p95, p99; kademeli testte gönderilen ve başarılı RPS. Hatalı anlar kırmızı.
// Yazdırmada net çıksın diye 3 kat çözünürlükle çizilir.

import { formatNumber } from "../core/i18n.js";
import { DEFAULT_WINDOW_SECONDS, roundTime, snapToWindow, formatTimeTick } from "../chart/chart-time.js";

// Beyaz zemine göre koyulaştırılmış renkler (uygulamadaki renklerin koyu tonları)
export const REPORT_CHART_COLORS = {
    avg: "#c99700",
    p95: "#0e8f8e",
    p99: "#6f52d1",
    success: "#8a7f68",
    sent: "#6b7280",
    error: "#e03131",
    errorFill: "rgba(224, 49, 49, 0.08)",
    avgFill: "rgba(201, 151, 0, 0.08)",
    grid: "#eceef1",
    tick: "#6b7280",
};

const FONT = { family: "'IBM Plex Mono', monospace", size: 9 };

// Her dilimin grafikteki zamanı (canlı grafikle aynı kural: dilim başladığı ana konur)
export function windowPositions(windows) {
    const xs = [];
    let last = -Infinity;

    for (const d of windows) {
        const w = d.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
        let x = roundTime(snapToWindow(d.elapsedSeconds, w) - w);
        if (x <= last) x = roundTime(last + w);
        if (x < 0) x = 0;
        xs.push(x);
        last = x;
    }

    return xs;
}

// seconds: [{ second, success }] (biten her saniyenin başarılı istek sayısı)
export function drawReportChart(canvas, windows, seconds, isStepped) {
    if (windows.length === 0) return null;

    const w = windows[0].windowSeconds ?? DEFAULT_WINDOW_SECONDS;
    const xs = windowPositions(windows);
    const last = windows.length - 1;
    const endX = roundTime(xs[last] + w);

    // Son dilimin bitişine kapanış noktası (canlı grafikteki gibi)
    const series = (pick) => [...windows.map((d, i) => ({ x: xs[i], y: pick(d) })), { x: endX, y: pick(windows[last]) }];
    const hasError = [...windows.map((d) => d.errorCount > 0), windows[last].errorCount > 0];

    const line = (data, color, extra = {}) => ({
        data,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 1.4,
        pointRadius: 0,
        cubicInterpolationMode: "monotone",
        fill: false,
        spanGaps: false,
        ...extra,
    });

    const datasets = [
        line(series((d) => d.avgResponseTime), REPORT_CHART_COLORS.avg, {
            borderWidth: 1.8,
            fill: "origin",
            backgroundColor: REPORT_CHART_COLORS.avgFill,
            segment: {
                borderColor: (ctx) => (hasError[ctx.p1DataIndex] ? REPORT_CHART_COLORS.error : undefined),
                backgroundColor: (ctx) => (hasError[ctx.p1DataIndex] ? REPORT_CHART_COLORS.errorFill : undefined),
            },
        }),
        line(series((d) => d.p95ResponseTime), REPORT_CHART_COLORS.p95),
        line(series((d) => d.p99ResponseTime), REPORT_CHART_COLORS.p99),
    ];

    if (isStepped) {
        datasets.push(
            line(
                seconds.map((s) => ({ x: s.second, y: s.success })),
                REPORT_CHART_COLORS.success,
                { yAxisID: "y1", pointRadius: 1.5, spanGaps: true }
            ),
            line(series((d) => d.targetRps), REPORT_CHART_COLORS.sent, {
                yAxisID: "y1",
                stepped: true,
                borderDash: [4, 3],
                borderWidth: 1,
            })
        );
    }

    return new Chart(canvas, {
        type: "line",
        data: { datasets },
        options: {
            responsive: false,
            animation: false,
            devicePixelRatio: 3,
            parsing: false,
            normalized: true,
            events: [],
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: {
                    type: "linear",
                    min: 0,
                    max: endX,
                    ticks: { color: REPORT_CHART_COLORS.tick, font: FONT, maxRotation: 0, callback: (v) => formatTimeTick(v, w) },
                    grid: { display: false },
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: REPORT_CHART_COLORS.tick, font: FONT, callback: (v) => `${formatNumber(Math.round(v))} ms` },
                    grid: { color: REPORT_CHART_COLORS.grid },
                },
                y1: {
                    display: isStepped,
                    position: "right",
                    beginAtZero: true,
                    ticks: { color: REPORT_CHART_COLORS.tick, font: FONT, callback: (v) => `${formatNumber(Math.round(v))} r/s` },
                    grid: { display: false },
                },
            },
        },
    });
}