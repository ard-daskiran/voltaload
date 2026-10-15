// Report page (/report.html?id=...): fetches the test's data and analysis, builds the report, draws the chart.
// "Save as PDF" opens the browser's print dialog.

import { $ } from "../core/dom.js";
import { t, applyTranslations, getLanguage, switchLanguage } from "../core/i18n.js";
import { createSecondAggregator } from "../dashboard/second-aggregator.js";
import { renderReport } from "../report/report-sections.js";
import { drawReportChart, windowPositions } from "../report/report-chart.js";

applyTranslations();

const testRunId = new URLSearchParams(window.location.search).get("id");
const printButton = $("report-print");

$("report-back").href = `/test.html?id=${encodeURIComponent(testRunId ?? "")}`;
printButton.addEventListener("click", () => window.print());


// Language selection: the selected one is yellow; clicking reloads the page in the new language
document.querySelectorAll(".lang-switch [data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === getLanguage());
    button.addEventListener("click", () => switchLanguage(button.dataset.lang));
});

function showMessage(text) {
    const p = document.createElement("p");
    p.className = "message";
    p.textContent = text;
    $("report").replaceChildren(p);
}

// Status code counts and per-second successful requests (for the chart's successful RPS line)
function summarizeWindows(windows) {
    const statusCounts = {};
    for (const w of windows) {
        for (const [code, count] of Object.entries(w.statusCounts)) {
            statusCounts[code] = (statusCounts[code] || 0) + count;
        }
    }

    const seconds = [];
    const aggregator = createSecondAggregator({
        onSecond: (endSecond, s) => seconds.push({ second: endSecond, success: s.success }),
    });
    const xs = windowPositions(windows);
    windows.forEach((w, i) => aggregator.add(xs[i], w));
    aggregator.flush();

    return { statusCounts, seconds };
}

async function load() {
    if (!testRunId) {
        showMessage(t("detail.notFoundTitle"));
        return;
    }

    try {
        const id = encodeURIComponent(testRunId);
        const [detailResponse, liveResponse, analysisResponse] = await Promise.all([
            fetch(`/api/test-run/${id}`),
            fetch(`/api/test-run/${id}/live`),
            fetch(`/api/test-run/${id}/analysis`),
        ]);

        if (detailResponse.status === 404) {
            showMessage(t("detail.notFoundTitle"));
            return;
        }
        if (!detailResponse.ok || !liveResponse.ok) {
            showMessage(t("detail.loadErrorTitle"));
            return;
        }

        const { testRun, summary } = await detailResponse.json();
        if (testRun.status === "RUNNING") {
            showMessage(t("report.pending"));
            return;
        }

        const { windows } = await liveResponse.json();
        const analysis = analysisResponse.ok ? await analysisResponse.json() : null;
        const { statusCounts, seconds } = summarizeWindows(windows);

        renderReport($("report"), { testRun, summary, analysis, statusCounts });

        // The chart is drawn after fonts load (so the axis labels use the right font)
        try {
            await document.fonts.ready;
        } catch {
            // If font info isn't available, continue without waiting
        }
        // Only non-empty windows go to the chart (so empty ones don't break the lines); second counts come from all windows
        drawReportChart(
            $("report-chart"),
            windows.filter((w) => w.requestCount > 0),
            seconds,
            testRun.loadProfile === "STEPPED"
        );

        printButton.disabled = false;
    } catch (err) {
        console.error(err);
        showMessage(t("detail.loadErrorTitle"));
    }
}

load();