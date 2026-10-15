// The detail page's four metric cards and the summary card.
// Values come from the whole test's summary (the TestRun record on the server).
// p95 and p99: a softly glowing vertical bar at the start in the chart line's color; the value and the info box title use the same color.
// Other rows are white (error rate is red if there are errors). The bar's space stays empty so the text stays aligned.
// Info boxes open upward (the card is at the very bottom of the page).

import { $ } from "../core/dom.js";
import { t, formatNumber, formatMs, formatPercent } from "../core/i18n.js";
import { attachHint } from "../core/info-hint.js";

// Colors (same as the chart lines)
const COLORS = {
    p95: "#64d8d7",
    p99: "#c4b5fd",
    error: "#ff5555",
    neutral: "#e1e2eb",
};

// Bytes → readable size (KB, MB, GB)
export function formatBytes(bytes) {
    if (bytes >= 1_000_000_000) return `${formatNumber(bytes / 1_000_000_000, 2)} GB`;
    if (bytes >= 1_000_000) return `${formatNumber(bytes / 1_000_000, 1)} MB`;
    return `${formatNumber(bytes / 1_000, 1)} KB`;
}

// color: color of the value and the info box title (white if not given)
// bar: if true, a softly glowing vertical bar in this color at the start
function summaryRow(label, value, hintKey, { color = COLORS.neutral, bar = false } = {}) {
    const row = document.createElement("div");
    row.className = "flex justify-between items-center gap-3 cursor-default";

    const dt = document.createElement("dt");
    dt.className = "text-on-surface-variant whitespace-nowrap flex items-center gap-2.5";

    // Space is reserved even without a bar (so the text stays aligned)
    const marker = document.createElement("span");
    marker.className = "inline-block w-0.5 h-4 rounded-full shrink-0";
    if (bar) {
        marker.style.background = color;
        marker.style.boxShadow = `0 0 6px ${color}`;
    }
    dt.append(marker, label);

    const dd = document.createElement("dd");
    dd.className = "font-semibold";
    dd.style.color = color;
    dd.textContent = value;

    row.append(dt, dd);
    attachHint({ container: row, labelEl: dt, hintKey, titleColor: color, position: "above" });
    return row;
}

export function createSummaryCards() {
    const list = $("summary-list");
    const empty = $("summary-empty");

    // If summary is null, the test got no measurable responses at all
    function show(summary) {
        if (!summary) {
            for (const id of ["m-avg", "m-count", "m-min", "m-max"]) $(id).textContent = "—";
            list.replaceChildren();
            list.hidden = true;
            empty.hidden = false;
            return;
        }

        $("m-avg").textContent = formatNumber(Math.round(summary.avgResponseTime));
        $("m-count").textContent = formatNumber(summary.totalRequests);
        $("m-min").textContent = formatNumber(summary.minResponseTime);
        $("m-max").textContent = formatNumber(summary.maxResponseTime);

        const seconds = summary.durationMs / 1000;
        const actualRps = seconds > 0 ? summary.totalRequests / seconds : null;
        const errorRate = summary.serverErrorCount / summary.totalRequests;

        list.replaceChildren(
            summaryRow(t("summary.p95"), formatMs(summary.p95), "p95", { color: COLORS.p95, bar: true }),
            summaryRow(t("summary.p99"), formatMs(summary.p99), "p99", { color: COLORS.p99, bar: true }),
            summaryRow(t("summary.stdDev"), formatMs(summary.stdDev), "stdDev"),
            summaryRow(
                t("summary.actualRps"),
                actualRps !== null ? `${formatNumber(actualRps, 1)} req/s` : "—",
                "actualRps"
            ),
            summaryRow(t("summary.errorRate"), formatPercent(errorRate), "errorRate", {
                color: errorRate > 0 ? COLORS.error : COLORS.neutral,
            }),
            summaryRow(t("summary.totalData"), formatBytes(summary.totalBytes), "totalData"),
            summaryRow(t("summary.duration"), t("detail.seconds", { value: formatNumber(seconds, 1) }), "duration")
        );
        list.hidden = false;
        empty.hidden = true;
    }

    return { show };
}