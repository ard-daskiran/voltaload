// Chart.js plugins: glow, vertical dashed line, curtain. And the fill under the average line.

import { SERIES, SECOND_DOT } from "./chart-theme.js";

// Subtle glow on the average, p95 and p99 lines
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

// Vertical dashed line marking the hovered moment while the mouse is over the chart
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

// Curtain: datasets are drawn only up to the revealed area.
// getRevealedX: a function that returns up to what time the curtain is currently open.
export function createRevealPlugin(getRevealedX) {
    return {
        id: "voltaReveal",
        beforeDatasetsDraw(chart) {
            const { left, top, right, bottom } = chart.chartArea;
            const margin = SECOND_DOT.hoverRadius; // So points at the edge aren't cut in half
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

// Fill under the average line that fades out downward
export function avgFill(context) {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return "transparent";

    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, "rgba(244, 194, 26, 0.22)");
    gradient.addColorStop(1, "rgba(244, 194, 26, 0)");
    return gradient;
}