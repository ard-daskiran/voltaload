// Raporun bölümleri: üst bilgi, sonuç, ana ölçümler, grafik, analiz, ayrıntılar.
// Kullanıcıdan gelen metinler (URL, isim, body) her zaman düz metin olarak eklenir.

import { t, formatNumber, formatMs, getLocale, formatPercent } from "../core/i18n.js";
import { VERSION } from "../core/header.js";
import { runStatusLabel } from "../status/run-status.js";
import { statusName, statusCategory, sortStatusCodes } from "../status/status-info.js";
import { formatBytes } from "../detail/summary-cards.js";
import {
    HEALTH_COLORS,
    HEALTH_ORDER,
    TONE_COLORS,
    healthLabel,
    capacityText,
    verdictSentence,
    eventText,
    eventColor,
    recommendationView,
    followUpText,
} from "../analysis/analysis-text.js";
import { REPORT_CHART_COLORS } from "./report-chart.js";
import { latencyLevel } from "../core/latency.js";


// Beyaz zemine göre koyu durum renkleri (uygulamadaki renklerin karşılığı)
const REPORT_HEALTH = {
    HEALTHY: "#0e8f8e",
    BORDERLINE: "#c99700",
    STRAINED: "#e8590c",
    COLLAPSED: "#e03131",
};

// Uygulamadaki renk → rapordaki karşılığı (olay ve öneri renkleri için)
const TO_REPORT_COLOR = {
    [HEALTH_COLORS.HEALTHY]: REPORT_HEALTH.HEALTHY,
    [HEALTH_COLORS.BORDERLINE]: REPORT_HEALTH.BORDERLINE,
    [HEALTH_COLORS.STRAINED]: REPORT_HEALTH.STRAINED,
    [HEALTH_COLORS.COLLAPSED]: REPORT_HEALTH.COLLAPSED,
};

const BOLT_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M37 7 L15 36 H30 L26 57 L49 27 H34 Z" fill="#f4c21a" stroke="#1b1f24" stroke-width="2" stroke-linejoin="round"/></svg>';

// Küçük öğe oluşturucu: h("div", { class: "x" }, "metin", başkaÖğe)
function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props ?? {})) {
        if (value === undefined || value === null || value === false) continue;
        if (key === "class") el.className = value;
        else if (key === "style") Object.assign(el.style, value);
        else el.setAttribute(key, value);
    }
    // İç içe listeler (örneğin [etiket, değer] çiftleri) tamamen açılır
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        el.append(child instanceof Node ? child : String(child));
    }
    return el;
}

function sectionTitle(text) {
    return h("h2", { class: "section-title" }, text);
}

function percent(value) {
    return formatPercent(value);
}

function formatDate(iso) {
    return new Date(iso).toLocaleString(getLocale());
}

function prettyBody(body) {
    try {
        return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
        return body;
    }
}

function profileText(testRun) {
    return testRun.loadProfile === "STEPPED"
        ? `${t("form.profile.stepped")} · ${t("detail.steps", { count: testRun.stepCount })}`
        : t("form.profile.constant");
}

// --- Üst bilgi ve hedef ---

function headerBlock() {
    const brand = h("div", { class: "brand" });
    brand.innerHTML = BOLT_SVG; // Sabit simge, kullanıcı verisi değil
    brand.append("VOLTA");

    return h(
        "div",
        { class: "report-header" },
        h("div", {}, brand, h("h1", { class: "report-title" }, t("report.title"))),
        h("div", { class: "header-meta" }, h("div", {}, `${t("report.generatedAt")}: ${new Date().toLocaleString(getLocale())}`), h("div", {}, `Volta ${VERSION}`))
    );
}

function targetBlock(testRun) {
    const rpsLabel = t(testRun.loadProfile === "STEPPED" ? "form.rpsStepped" : "detail.targetRps");
    const meta = [
        testRun.method,
        profileText(testRun),
        `${rpsLabel}: ${formatNumber(testRun.targetRps)}`,
        t("detail.seconds", { value: testRun.duration }),
        formatDate(testRun.createdAt),
        runStatusLabel(testRun.status),
    ].join(" · ");

    return h(
        "div",
        { class: "target" },
        testRun.targetName ? h("div", { class: "target-name" }, testRun.targetName) : null,
        h("div", { class: testRun.targetName ? "target-url" : "target-name" }, testRun.url),
        h("div", { class: "target-meta" }, meta)
    );
}

// --- Sonuç: gösterge, kapasite, cümle ---

function gauge(state) {
    const bar = h("div", { class: "gauge-bar" });
    const labels = h("div", { class: "gauge-labels" });
    const marks = h("div", { class: "gauge-marks" });

    for (const s of HEALTH_ORDER) {
        const active = s === state;
        bar.append(h("div", { style: { background: REPORT_HEALTH[s], opacity: active ? "1" : "0.22" } }));
        marks.append(h("div", { style: { color: REPORT_HEALTH[s] } }, active ? "▲" : ""));
        labels.append(
            h("div", { style: { color: active ? REPORT_HEALTH[s] : "#9aa3ab", fontWeight: active ? "700" : "400" } }, healthLabel(s))
        );
    }

    return h("div", { class: "gauge" }, bar, marks, labels);
}

function resultSection(analysis, testRun) {
    if (analysis?.status !== "ready") {
        return h("div", { class: "keep" }, sectionTitle(t("report.result")), h("p", {}, t("report.analysisUnavailable")));
    }

    const { verdict } = analysis;
    const recTypes = analysis.recommendations.map((r) => r.type);
    const warnings = [
        analysis.voltaOverloaded && t("analysis.voltaOverloaded"),
        analysis.stopped && t(`analysis.ended.${analysis.endReason}`),
        recTypes.includes("redirects") && t("analysis.redirectsNotice"),
        recTypes.includes("clientErrors") && t("analysis.clientErrorsNotice"),
        recTypes.includes("rateLimited") && t("analysis.rateLimitedNotice"),
    ].filter(Boolean);

    return h(
        "div",
        { class: "keep" },
        sectionTitle(t("report.result")),
        h(
            "div",
            { class: "result" },
            gauge(verdict.state),
            h(
                "div",
                { class: "capacity" },
                h("div", { class: "capacity-label" }, t("analysis.capacity")),
                h("div", { class: "capacity-number", style: { color: REPORT_HEALTH[verdict.state] } }, capacityText(verdict.capacity))
            )
        ),
        h("p", { class: "verdict" }, verdictSentence(analysis, testRun.loadProfile === "STEPPED")),
        warnings.map((text) => h("div", { class: "warning" }, `⚠ ${text}`))
    );
}

// --- Ana ölçümler ---

function metricsSection(summary) {
    const seconds = summary ? summary.durationMs / 1000 : 0;
    const errorRate = summary ? summary.serverErrorCount / summary.totalRequests : null;

    const items = [
        [t("chart.series.avg"), summary ? formatMs(summary.avgResponseTime) : "—"],
        [t("summary.p95"), summary ? formatMs(summary.p95) : "—"],
        [t("summary.p99"), summary ? formatMs(summary.p99) : "—"],
        [t("summary.errorRate"), errorRate !== null ? percent(errorRate) : "—"],
        [t("summary.actualRps"), summary && seconds > 0 ? `${formatNumber(summary.totalRequests / seconds, 1)}` : "—"],
        [t("report.totalRequests"), summary ? formatNumber(summary.totalRequests) : "—"],
    ];

    return h(
        "div",
        { class: "keep" },
        sectionTitle(t("report.keyMetrics")),
        h(
            "div",
            { class: "metrics" },
            items.map(([label, value]) => h("div", { class: "metric" }, h("div", { class: "metric-label" }, label), h("div", { class: "metric-value" }, value)))
        )
    );
}

// --- Grafik ---

function chartSection(isStepped) {
    const legendItem = (label, color, dashed = false) =>
        h("span", {}, h("i", { class: dashed ? "dashed" : "", style: dashed ? {} : { background: color } }), label);

    const canvas = h("canvas", { id: "report-chart", width: "680", height: "260" });

    return h(
        "div",
        { class: "keep" },
        sectionTitle(t("report.chart")),
        h(
            "div",
            { class: "chart-box" },
            h(
                "div",
                { class: "legend" },
                legendItem(t("chart.series.avg"), REPORT_CHART_COLORS.avg),
                legendItem(t("chart.series.p95"), REPORT_CHART_COLORS.p95),
                legendItem(t("chart.series.p99"), REPORT_CHART_COLORS.p99),
                isStepped && legendItem(t("chart.series.completedRps"), REPORT_CHART_COLORS.success),
                isStepped && legendItem(t("chart.series.sentRps"), REPORT_CHART_COLORS.sent, true)
            ),
            canvas
        )
    );
}

// --- Analiz: olaylar, kademeler, öneriler ---

function eventsTable(events) {
    return h(
        "table",
        { class: "data" },
        h("thead", {}, h("tr", {}, h("th", { style: { width: "70px" } }, t("report.eventTime")), h("th", {}, t("report.eventText")))),
        h(
            "tbody",
            {},
            events.map((e) => {
                const color = TO_REPORT_COLOR[eventColor(e)] ?? null;
                return h(
                    "tr",
                    {},
                    h("td", { class: "num" }, t("analysis.seconds", { value: e.second })),
                    h("td", { style: color ? { color } : {} }, eventText(e))
                );
            })
        )
    );
}

// Gecikme rengi (sınırlar core/latency.js'te): normal siyah, yavaş hardal, kritik kırmızı
const LATENCY_STYLES = {
    none: {},
    normal: {},
    slow: { color: REPORT_HEALTH.BORDERLINE },
    critical: { color: REPORT_HEALTH.COLLAPSED },
};

function latencyColor(ms) {
    return LATENCY_STYLES[latencyLevel(ms)];
}

function stepsTable(steps) {
    const th = (key, num = false) => h("th", { class: num ? "num" : "" }, t(key));

    return h(
        "table",
        { class: "data" },
        h(
            "thead",
            {},
            h(
                "tr",
                {},
                th("steps.col.step"),
                th("steps.col.target", true),
                th("steps.col.actual", true),
                th("steps.col.avg", true),
                th("steps.col.p95", true),
                th("steps.col.errors", true),
                th("steps.col.state")
            )
        ),
        h(
            "tbody",
            {},
            steps.map((s) =>
                h(
                    "tr",
                    {},
                    h("td", {}, String(s.index)),
                    h("td", { class: "num" }, `${formatNumber(s.targetRps)} RPS`),
                    h("td", { class: "num" }, `${formatNumber(s.actualRps, 1)} RPS`),
                    h("td", { class: "num", style: latencyColor(s.avg) }, formatMs(s.avg)),
                    h("td", { class: "num", style: latencyColor(s.p95) }, formatMs(s.p95)),
                    h("td", { class: "num", style: s.errorRate > 0 ? { color: REPORT_HEALTH.COLLAPSED } : {} }, percent(s.errorRate)),
                    h("td", { style: { color: REPORT_HEALTH[s.state], fontWeight: "600" } }, `● ${healthLabel(s.state)}`)
                )
            )
        )
    );
}

function recommendationsList(recommendations) {
    if (recommendations.length === 0) return h("p", {}, t("report.noRecommendations"));

    return h(
        "div",
        {},
        recommendations.map((rec) => {
            const view = recommendationView(rec);
            const color = TO_REPORT_COLOR[TONE_COLORS[view.tone]] ?? REPORT_HEALTH.BORDERLINE;
            return h(
                "div",
                { class: "rec" },
                h("div", { class: "rec-bar", style: { background: color } }),
                h(
                    "div",
                    {},
                    h("div", { class: "rec-title" }, view.title),
                    h("div", { class: "rec-text" }, view.text),
                    view.test ? h("div", { class: "rec-test" }, t("report.suggestedTest", { settings: followUpText(view.test) })) : null
                )
            );
        })
    );
}

function analysisSection(analysis) {
    if (analysis?.status !== "ready") return [];

    const parts = [];

    if (analysis.events.length > 0) {
        parts.push(h("div", { class: "sub-title" }, t("report.events")), eventsTable(analysis.events));
    }
    if (analysis.steps.length > 0) {
        parts.push(h("div", { class: "keep" }, h("div", { class: "sub-title" }, t("report.steps")), stepsTable(analysis.steps)));
    }
    parts.push(h("div", { class: "sub-title accent" }, t("report.recommendations")), recommendationsList(analysis.recommendations));

    return parts;
}

// --- Ayrıntılar: durum kodları, ayarlar, terimler, uyarı ---

function statusCodesTable(statusCounts) {
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return h("p", {}, t("statusCard.empty"));

    return h(
        "table",
        { class: "data" },
        h(
            "thead",
            {},
            h(
                "tr",
                {},
                h("th", {}, t("report.col.code")),
                h("th", {}, t("report.col.name")),
                h("th", { class: "num" }, t("report.col.count")),
                h("th", { class: "num" }, t("report.col.share")),
                h("th", {}, t("report.col.category"))
            )
        ),
        h(
            "tbody",
            {},
            sortStatusCodes(Object.keys(statusCounts)).map((code) => {
                const category = statusCategory(code);
                const color = category === "serverError" ? REPORT_HEALTH.COLLAPSED : category === "clientError" ? REPORT_HEALTH.BORDERLINE : null;
                return h(
                    "tr",
                    {},
                    h("td", { style: color ? { color, fontWeight: "600" } : { fontWeight: "600" } }, code),
                    h("td", {}, statusName(code)),
                    h("td", { class: "num" }, formatNumber(statusCounts[code])),
                    h("td", { class: "num" }, percent(statusCounts[code] / total)),
                    h("td", {}, t(`status.tag.${category}`))
                );
            })
        )
    );
}

function settingsBlock(testRun, summary) {
    const rows = [
        [t("form.url"), testRun.targetName ? `${testRun.targetName} · ${testRun.url}` : testRun.url],
        [t("form.method"), testRun.method],
        [t("form.profile"), profileText(testRun)],
        [t(testRun.loadProfile === "STEPPED" ? "form.rpsStepped" : "detail.targetRps"), formatNumber(testRun.targetRps)],
        [t("detail.duration"), t("detail.seconds", { value: testRun.duration })],
        summary && [t("summary.duration"), t("detail.seconds", { value: formatNumber(summary.durationMs / 1000, 1) })],
        summary && [t("summary.totalData"), formatBytes(summary.totalBytes)],
        [t("detail.status"), runStatusLabel(testRun.status)],
        [t("detail.date"), formatDate(testRun.createdAt)],
        testRun.maxLagMs !== null && testRun.maxLagMs !== undefined && [t("report.maxLag"), `${formatNumber(testRun.maxLagMs)} ms`],
    ].filter(Boolean);

    return h(
        "div",
        { class: "keep" },
        h("div", { class: "sub-title" }, t("report.settings")),
        h("dl", { class: "kv" }, rows.map(([label, value]) => [h("dt", {}, label), h("dd", {}, value)])),
        testRun.body ? [h("div", { class: "sub-title" }, t("form.body")), h("pre", { class: "body" }, prettyBody(testRun.body))] : null
    );
}

// Terimler: üç sütunlu kartlar. Ortalama, p95 ve p99'un altındaki çizgi grafikteki renkleriyle aynı,
// hata oranınınki kırmızı, diğerleri siyah.
function glossaryBlock() {
    const terms = [
        ["chart.series.avg", "avg", REPORT_CHART_COLORS.avg],
        ["summary.p95", "p95", REPORT_CHART_COLORS.p95],
        ["summary.p99", "p99", REPORT_CHART_COLORS.p99],
        ["summary.stdDev", "stdDev", null],
        ["summary.actualRps", "actualRps", null],
        ["summary.errorRate", "errorRate", REPORT_HEALTH.COLLAPSED],
    ];

    return h(
        "div",
        {},
        h("div", { class: "sub-title" }, t("report.glossary")),
        h(
            "div",
            { class: "glossary" },
            terms.map(([labelKey, key, color]) =>
                h(
                    "div",
                    { class: "term" },
                    h("span", { class: "term-title", style: color ? { borderBottomColor: color } : {} }, t(labelKey)),
                    h("p", { class: "term-text" }, t(`hint.${key}.text`))
                )
            )
        )
    );
}

function disclaimerBlock() {
    return h("div", { class: "disclaimer" }, h("strong", {}, t("report.aboutAnalysis")), t("hint.analysisDisclaimer.text"));
}

function footer() {
    return h("div", { class: "footer" }, h("span", {}, t("report.footer", { version: VERSION })), h("span", {}, new Date().toLocaleString(getLocale())));
}

// --- Rapor ---

export function renderReport(container, { testRun, summary, analysis, statusCounts }) {
    const isStepped = testRun.loadProfile === "STEPPED";

    container.replaceChildren(
        headerBlock(),
        targetBlock(testRun),
        resultSection(analysis, testRun),
        metricsSection(summary),
        chartSection(isStepped),
        ...analysisSection(analysis),
        h("div", { class: "sub-title" }, t("report.statusCodes")),
        statusCodesTable(statusCounts),
        settingsBlock(testRun, summary),
        glossaryBlock(),
        disclaimerBlock(),
        footer()
    );
}