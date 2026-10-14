// test-detail.js
// Test detay sayfası (/test.html?id=...): parçaları kurar ve testin verisini yükler.
// Grafik, durum kodu kartı ve saniyelik toplama anasayfadakilerin aynısı.
// Analiz, sayfanın geri kalanı göründükten sonra ayrıca yüklenir (bir sorun olursa sayfa etkilenmez).

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
document.title = t("detail.pageTitle");

// Hata ekranının iki hali
const ERRORS = {
    notFound: { icon: "search_off", title: "detail.notFoundTitle", text: "detail.notFoundText" },
    loadError: { icon: "cloud_off", title: "detail.loadErrorTitle", text: "detail.loadErrorText" },
};

// Yönlendirme kodları: Volta bunları takip etmez, cevap olarak kaydeder
const REDIRECT_CODES = ["301", "302", "303", "307", "308"];
const REDIRECT_WARNING_RATIO = 0.5;

const testRunId = new URLSearchParams(window.location.search).get("id");

// "← Geçmiş" bağlantıları listeyi kaldığın haliyle açsın
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

// Biten her saniye: başarılı RPS noktası ve bilgi kutusundaki saniyelik sayılar
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

// kind: "notFound" ya da "loadError"
function showError(kind) {
    const error = ERRORS[kind];
    $("detail-main").hidden = true;
    $("detail-error").hidden = false;
    $("detail-error-icon").textContent = error.icon;
    $("detail-error-title").textContent = t(error.title);
    $("detail-error-text").textContent = t(error.text);
}

// Cevapların en az yarısı yönlendirmeyse uyarı şeridini göster
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

// Dilimleri canlı testteki gibi sırayla grafiğe ver
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

// --- Analiz ---

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

// --- Rapor ---

// Test bitmişse rapor butonu aktif, yeni sekmede rapor sayfasını açar
function setupReport(testRun) {
    const link = $("report-btn");
    const running = testRun.status === "RUNNING";

    link.href = running ? "#" : `/report.html?id=${encodeURIComponent(testRun.id)}`;
    link.classList.toggle("opacity-40", running);
    link.classList.toggle("pointer-events-none", running);
    link.title = running ? t("report.runningHint") : "";
}

// --- Test silme ---

function setupDelete(testRun) {
    const button = $("delete-btn");
    const running = testRun.status === "RUNNING";

    button.disabled = running;
    // Butonda yazı yok, sadece simge: ne yaptığı ipucunda yazar
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
                // 404: zaten silinmiş, amaca ulaşılmış sayılır
                if (!response.ok && response.status !== 404) throw new Error(t("deleteTest.failed"));
            },
        });

        // Silindiyse listeye, kaldığın yere dön. Bildirim liste açılınca gösterilir.
        if (deleted) {
            queueToast(t("deleteTest.toast"), { detail: shortUrl(testRun.url), type: "danger" });
            window.location.href = returnUrl;
        }
    });
}

// --- Yükleme ---

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

        // Sayfanın geri kalanı göründükten sonra
        loadAnalysis(testRun);
    } catch (err) {
        console.error(err);
        showError("loadError");
    }
}

initLegend();
$("zoom-reset").addEventListener("click", resetChartZoom);
load();