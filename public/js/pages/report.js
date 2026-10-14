// Rapor sayfası (/report.html?id=...): testin verisini, analizini çeker, raporu kurar, grafiği çizer.
// "PDF olarak kaydet" tarayıcının yazdırma penceresini açar.

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


// Dil seçimi: seçili olan sarı, tıklanınca sayfa yeni dille yenilenir
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

// Durum kodu sayıları ve saniyelik başarılı istekler (grafiğin başarılı RPS çizgisi için)
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

        // Grafik, yazı tipleri yüklendikten sonra çizilir (eksen yazıları doğru fontla çıksın)
        try {
            await document.fonts.ready;
        } catch {
            // Yazı tipi bilgisi alınamazsa beklemeden devam et
        }
        // Grafiğe sadece dolu dilimler (boş dilimler çizgileri koparmasın); saniye sayıları bütün dilimlerden
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