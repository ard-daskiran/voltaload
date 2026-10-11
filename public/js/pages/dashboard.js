// Anasayfa: parçaları kurar ve birbirine bağlar. Kendisi hesap yapmaz.

import { $ } from "../core/dom.js";
import { t, applyTranslations, onBeforeLanguageSwitch } from "../core/i18n.js";
import { renderHeader } from "../core/header.js";
import { attachHintsFromMarkup } from "../core/info-hint.js";
import { createStatusCard } from "../status/status-card.js";
import { createChart, addWindow, addSecondPoint, closeChart, resetChartZoom, initLegend } from "../chart/live-chart.js";
import { createTestForm } from "../dashboard/test-form.js";
import { createTestSession } from "../dashboard/test-session.js";
import { createLiveMetrics } from "../dashboard/live-metrics.js";
import { createSecondAggregator } from "../dashboard/second-aggregator.js";
import { createRequestLog } from "../dashboard/request-log.js";
import { createVoltaStatus } from "../dashboard/volta-status.js";
import { createTargetBook } from "../dashboard/target-book.js";
import { createSaveSuggestion } from "../dashboard/save-suggestion.js";

renderHeader();
applyTranslations();
attachHintsFromMarkup();

// --- Parçalar ---

const form = createTestForm();
// Dil değişince sayfa yenilenir: formda yazılmış değerler kaybolmasın
onBeforeLanguageSwitch(form.saveDraft);
const targetBook = createTargetBook({ getCurrentUrl: form.getUrl, onSelect: form.setUrl });
const saveSuggestion = createSaveSuggestion({ onSave: (url) => targetBook.open({ addUrl: url }) });
const metrics = createLiveMetrics();
const voltaStatus = createVoltaStatus();
const requestLog = createRequestLog($("terminal-log"));

const statusCard = createStatusCard({
    rowsEl: $("status-rows"),
    barEl: $("status-bar"),
    emptyEl: $("status-empty"),
    totalEl: $("status-total"),
});

// Bir saniye dolunca: başarılı RPS noktası, "İstek" kartının anlık değeri, günlük satırı
const seconds = createSecondAggregator({
    onSecond: (endSecond, s) => {
        addSecondPoint(endSecond, {
            target: s.target,
            total: s.total,
            success: s.success,
            errors: s.errors,
            errorCodes: s.errorCodes,
        });
        metrics.setLiveRequests(s.total);
        requestLog.appendSecond(endSecond, s);
    },
});

// Çalışan (ya da en son çalışan) testin URL'si: test bitince kaydetme önerisi için
let currentTestUrl = null;

// --- Akış ---

// Yeni bir test için ekranı sıfırla
function prepareView(durationSeconds, profile) {
    createChart(durationSeconds, profile);
    metrics.reset();
    statusCard.reset();
    requestLog.reset();
    voltaStatus.reset();
    seconds.reset();
}

// Her yeni dilim (canlı akış ve yeniden bağlanma aynı yoldan geçer)
function handleWindow(d) {
    const x = addWindow(d);
    if (x === null) return;

    metrics.addWindow(d);
    statusCard.update(metrics.getStatusCounts(), metrics.getRequests());
    voltaStatus.update(d);
    seconds.add(x, d);
}

function finishTest(message, isError = false) {
    seconds.flush();
    closeChart();
    form.setStatus(message, isError);
    form.setLocked(false);
    voltaStatus.hideWarning();
}

const session = createTestSession({
    onWindow: handleWindow,
    onDone: (status) => {
        finishTest(status === "STOPPED" ? t("state.stopped") : t("state.completed"));
        // Tamamlanan ya da durdurulan testten sonra: URL rehberde yoksa kaydetmeyi öner
        saveSuggestion.maybeSuggest(currentTestUrl);
    },
    onError: (message) => finishTest(t("state.error", { message }), true),
});

// --- Butonlar ---

form.onSubmit(async () => {
    const input = form.readPayload();
    if (!input.ok) {
        form.setStatus(t("state.error", { message: input.error }), true);
        return;
    }

    form.setStatus(t("state.starting"));
    form.setStartBusy(true);
    const result = await session.start(input.payload);
    form.setStartBusy(false);

    if (!result.ok) {
        form.setStatus(result.unreachable ? t("state.serverUnreachable") : t("state.error", { message: result.error }), true);
        return;
    }

    currentTestUrl = input.payload.url;
    prepareView(input.payload.duration, input.payload.loadProfile);
    session.follow(result.testRunId);
    form.setLocked(true);
    form.setStatus(t("state.running"));
});

form.onStop(async () => {
    form.setStatus(t("state.stopping"));
    form.setStopBusy(true);
    const result = await session.stop();
    form.setStopBusy(false);
    if (!result.ok) form.setStatus(t("state.serverUnreachable"), true);
});

$("zoom-reset").addEventListener("click", resetChartZoom);
$("target-book-btn").addEventListener("click", () => targetBook.open());

// --- Başlangıç ---

async function init() {
    initLegend();
    prepareView(10, "CONSTANT");
    form.setStatus(t("state.ready"));

    const resumed = await session.resume((active) => {
        const config = active.config;
        currentTestUrl = config.url;
        form.fillFromConfig(config);
        prepareView(config.durationSeconds, config.profile?.type ?? "CONSTANT");
        form.setLocked(true);
    });

    if (resumed === "resumed") {
        form.setStatus(t("state.reconnected"));
    } else if (resumed === "finished") {
        finishTest(t("state.completed"));
    } else {
        // Önce "yeniden çalıştır" ayarları, yoksa dil değişiminden kalan taslak
        form.applyRerunSettings() || form.restoreDraft();
    }
}

init();