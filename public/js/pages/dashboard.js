// Home page: builds the parts and wires them together. It doesn't do any calculations itself.

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
import { createConnectionOverlay } from "../core/connection-overlay.js";

renderHeader();
applyTranslations();
attachHintsFromMarkup();

// --- Parts ---

const form = createTestForm();
// The page reloads when the language changes: don't lose the values typed into the form
onBeforeLanguageSwitch(form.saveDraft);
const targetBook = createTargetBook({ getCurrentUrl: form.getUrl, onSelect: form.setUrl });
const saveSuggestion = createSaveSuggestion({ onSave: (url) => targetBook.open({ addUrl: url }) });
const metrics = createLiveMetrics();
const voltaStatus = createVoltaStatus();
const requestLog = createRequestLog($("terminal-log"));
const connectionOverlay = createConnectionOverlay();

const statusCard = createStatusCard({
    rowsEl: $("status-rows"),
    barEl: $("status-bar"),
    emptyEl: $("status-empty"),
    totalEl: $("status-total"),
});

// When a second completes: successful RPS point, the "Requests" card's current value, log row
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

// URL of the running (or most recently run) test: for the save suggestion when the test ends
let currentTestUrl = null;

// --- Flow ---

// Reset the screen for a new test
function prepareView(durationSeconds, profile) {
    createChart(durationSeconds, profile);
    metrics.reset();
    statusCard.reset();
    requestLog.reset();
    voltaStatus.reset();
    seconds.reset();
}

// Every new window (the live stream and reconnection go through the same path)
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
        // After a completed or stopped test: suggest saving the URL if it's not in the target book
        saveSuggestion.maybeSuggest(currentTestUrl);
    },
    onError: (message) => finishTest(t("state.error", { message }), true),
    onConnectionLost: connectionOverlay.lost,
    onConnectionRestored: connectionOverlay.restored,
});

// --- Buttons ---

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

// --- Startup ---

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
        // "Run again" settings first, otherwise the draft left over from a language change
        form.applyRerunSettings() || form.restoreDraft();
    }
}

init();