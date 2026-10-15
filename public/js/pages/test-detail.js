// test-detail.js
// Test detail page (/test.html?id=...): builds the parts and loads the test's data.
// The chart, status code card and per-second aggregation are the same as on the home page.
// The analysis loads separately after the rest of the page is visible (so a problem doesn't affect the page).

import { $ } from "../core/dom.js";
import { t, applyTranslations, getLocale, formatNumber } from "../core/i18n.js";
import { renderHeader } from "../core/header.js";
import { attachHintsFromMarkup } from "../core/info-hint.js";
import { confirmDialog } from "../core/confirm-dialog.js";
import { queueToast } from "../core/toast.js";
import { createStatusCard } from "../status/status-card.js";
import { createChart, addWindow, addSecondPoint, closeChart, resetChartZoom, initLegend } from "../chart/live-chart.js";
import { createSecondAggregator } from "../dashboard/second-aggregator.js";
import { createTestSettings } from "../detail/test-settings.js";
import { createSummaryCards } from "../detail/summary-cards.js";
import { createAnalysisCard } from "../detail/analysis-card.js";
import { createStepsTable } from "../detail/steps-table.js";
import { openRecommendations } from "../detail/recommendations-dialog.js";
import { getReturnUrl } from "../history/return-to-list.js";
import { shortUrl } from "../core/url.js";

renderHeader();
applyTranslations();
attachHintsFromMarkup();

// The two variants of the error screen
const ERRORS = {
    notFound: { icon: "search_off", title: "detail.notFoundTitle", text: "detail.notFoundText" },
    loadError: { icon: "cloud_off", title: "detail.loadErrorTitle", text: "detail.loadErrorText" },
};

// Redirect codes: Volta doesn't follow them, it records them as responses
const REDIRECT_CODES = ["301", "302", "303", "307", "308"];
const REDIRECT_WARNING_RATIO = 0.5;

const testRunId = new URLSearchParams(window.location.search).get("id");

// "← History" links open the list in the state you left it
const returnUrl = getReturnUrl(testRunId);
document.querySelectorAll("[data-history-link]").forEach((link) => (link.href = returnUrl));

let currentTestRun = null;

const settings = createTestSettings();
const summaryCards = createSummaryCards();
const stepsTable = createStepsTable();
const analysisCard = createAnalysisCard({
    onOpenRecommendations: (recommendations) => openRecommendations(recommendations, currentTestRun),
});

const statusCard = createStatusCard({
    rowsEl: $("status-rows"),
    barEl: $("status-bar"),
    emptyEl: $("status-empty"),
    totalEl: $("status-total"),
});

// Every finished second: successful RPS point and the per-second counts in the tooltip
const seconds = createSecondAggregator({
    onSecond: (endSecond, s) => {
        addSecondPoint(endSecond, {
            target: s.target,
            total: s.total,
            success: s.success,
            errors: s.errors,
            errorCodes: s.errorCodes,
        });
    },
});

// kind: "notFound" or "loadError"
function showError(kind) {
    const error = ERRORS[kind];
    $("detail-main").hidden = true;
    $("detail-error").hidden = false;
    $("detail-error-icon").textContent = error.icon;
    $("detail-error-title").textContent = t(error.title);
    $("detail-error-text").textContent = t(error.text);
}

// Show the warning strip if at least half the responses are redirects
function updateRedirectNotice(statusCounts, total) {
    const codes = Object.keys(statusCounts).filter((code) => REDIRECT_CODES.includes(code)).sort();
    const redirects = codes.reduce((sum, code) => sum + statusCounts[code], 0);
    const show = total > 0 && redirects / total >= REDIRECT_WARNING_RATIO;

    $("redirect-notice").hidden = !show;
    if (show) {
        $("redirect-notice-text").textContent = t("detail.redirectWarning", {
            codes: codes.join(", "),
            percent: formatNumber((redirects / total) * 100, 0),
        });
    }
}

// Feed the windows to the chart in order, like in a live test
function drawChart(testRun, windows) {
    createChart(testRun.duration, testRun.loadProfile);

    const statusCounts = {};
    let total = 0;

    for (const w of windows) {
        const x = addWindow(w);
        if (x === null) continue;

        seconds.add(x, w);
        total += w.requestCount;
        for (const [code, count] of Object.entries(w.statusCounts)) {
            statusCounts[code] = (statusCounts[code] || 0) + count;
        }
    }

    seconds.flush();
    closeChart();
    statusCard.update(statusCounts, total);
    updateRedirectNotice(statusCounts, total);
}

// --- Analysis ---

async function loadAnalysis(testRun) {
    try {
        const response = await fetch(`/api/test-run/${encodeURIComponent(testRun.id)}/analysis`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const analysis = await response.json();

        analysisCard.show(analysis, testRun);
        stepsTable.show(analysis.status === "ready" ? analysis.steps : []);
    } catch (err) {
        console.error(err);
        analysisCard.message("analysis.loadError", true);
    }
}

// --- Report ---

// If the test has ended the report button is enabled and opens the report page in a new tab
function setupReport(testRun) {
    const link = $("report-btn");
    const running = testRun.status === "RUNNING";

    link.href = running ? "#" : `/report.html?id=${encodeURIComponent(testRun.id)}`;
    link.classList.toggle("opacity-40", running);
    link.classList.toggle("pointer-events-none", running);
    link.title = running ? t("report.runningHint") : "";
}

// --- Deleting the test ---

function setupDelete(testRun) {
    const button = $("delete-btn");
    const running = testRun.status === "RUNNING";

    button.disabled = running;
    // The button has no text, only an icon: what it does is in the tooltip
    button.title = running ? t("deleteTest.runningHint") : t("deleteTest.button");

    button.addEventListener("click", async () => {
        const deleted = await confirmDialog({
            title: t("deleteTest.title"),
            message: t("deleteTest.message"),
            details: [testRun.url, new Date(testRun.createdAt).toLocaleString(getLocale())],
            confirmLabel: t("deleteTest.confirm"),
            busyLabel: t("deleteTest.busy"),
            doneLabel: t("deleteTest.done"),
            onConfirm: async () => {
                const response = await fetch(`/api/test-run/${encodeURIComponent(testRun.id)}`, { method: "DELETE" });
                if (response.status === 409) throw new Error(t("deleteTest.runningHint"));
                // 404: already deleted, which counts as success
                if (!response.ok && response.status !== 404) throw new Error(t("deleteTest.failed"));
            },
        });

        // If deleted, return to the list where you left off. The notification shows when the list opens.
        if (deleted) {
            queueToast(t("deleteTest.toast"), { detail: shortUrl(testRun.url), type: "danger" });
            window.location.href = returnUrl;
        }
    });
}

// --- Loading ---

async function load() {
    if (!testRunId) {
        showError("notFound");
        return;
    }

    try {
        const [detailResponse, liveResponse] = await Promise.all([
            fetch(`/api/test-run/${encodeURIComponent(testRunId)}`),
            fetch(`/api/test-run/${encodeURIComponent(testRunId)}/live`),
        ]);

        if (detailResponse.status === 404) {
            showError("notFound");
            return;
        }
        if (!detailResponse.ok || !liveResponse.ok) {
            showError("loadError");
            return;
        }

        const { testRun, summary } = await detailResponse.json();
        const { windows } = await liveResponse.json();

        currentTestRun = testRun;
        settings.show(testRun);
        summaryCards.show(summary);
        drawChart(testRun, windows);
        setupDelete(testRun);
        setupReport(testRun);
        $("running-notice").hidden = testRun.status !== "RUNNING";

        // After the rest of the page is visible
        loadAnalysis(testRun);
    } catch (err) {
        console.error(err);
        showError("loadError");
    }
}

initLegend();
$("zoom-reset").addEventListener("click", resetChartZoom);
load();