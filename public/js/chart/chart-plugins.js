// Chart.js eklentileri: parlama, dikey kesikli çizgi, perde. Ve ortalama çizgisinin dolgusu.

import { SERIES, SECOND_DOT } from "./chart-theme.js";

// Ortalama, p95 ve p99 çizgilerinde hafif parlama
export const glowPlugin = {
    id: "voltaGlow",
    beforeDatasetDraw(chart, args) {
        if (args.index > SERIES.P99) return;
        chart.ctx.save();
        chart.ctx.shadowColor = chart.data.datasets[args.index].borderColor;
        chart.ctx.shadowBlur = 6;
    },
    afterDatasetDraw(chart, args) {
        if (args.index > SERIES.P99) return;
        chart.ctx.restore();
    },
};

// Fare grafiğin üzerindeyken o anı gösteren dikey kesikli çizgi
export const crosshairPlugin = {
    id: "voltaCrosshair",
    afterDatasetsDraw(chart) {
        const active = chart.tooltip?.getActiveElements?.() ?? [];
        if (active.length === 0) return;

        const x = active[0].element.x;
        const { top, bottom } = chart.chartArea;
        const ctx = chart.ctx;

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(225, 226, 235, 0.35)";
        ctx.lineWidth = 1;
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        ctx.restore();
    },
};

// Perde: veri setleri sadece açılmış alana kadar çizilir.
// getRevealedX: perdenin şu an hangi zamana kadar açık olduğunu döndüren fonksiyon.
export function createRevealPlugin(getRevealedX) {
    return {
        id: "voltaReveal",
        beforeDatasetsDraw(chart) {
            const { left, top, right, bottom } = chart.chartArea;
            const margin = SECOND_DOT.hoverRadius; // Kenardaki noktalar yarım kesilmesin
            const edge = Math.min(right + margin, chart.scales.x.getPixelForValue(getRevealedX()) + margin);

            chart.ctx.save();
            chart.ctx.beginPath();
            chart.ctx.rect(left - margin, top - margin, edge - left + margin, bottom - top + margin * 2);
            chart.ctx.clip();
        },
        afterDatasetsDraw(chart) {
            chart.ctx.restore();
        },
    };
}

// Ortalama çizgisinin altındaki, aşağı doğru silikleşen dolgu
export function avgFill(context) {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return "transparent";

    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, "rgba(244, 194, 26, 0.22)");
    gradient.addColorStop(1, "rgba(244, 194, 26, 0)");
    return gradient;
}