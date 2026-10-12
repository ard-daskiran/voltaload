// Detay sayfasının analiz kartı: durum, küçük gösterge, tahmini kapasite, sonuç cümlesi, uyarılar, olaylar.
// Öneriler ayrı bir pencerede (kartın sağ altındaki buton).

import { $ } from "../core/dom.js";
import { t } from "../core/i18n.js";
import {
    HEALTH_COLORS,
    HEALTH_ORDER,
    healthLabel,
    capacityText,
    verdictSentence,
    eventText,
    eventColor,
} from "../analysis/analysis-text.js";

function el(tag, className = "", text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Küçük gösterge: dört renkli bölge, bulunulan bölge parlak ve altında ok
function gauge(state) {
    const wrap = el("div", "flex flex-col gap-0.5");
    const bar = el("div", "flex h-1.5 gap-0.5");
    const marks = el("div", "flex");

    for (const s of HEALTH_ORDER) {
        const segment = el("div", "flex-1 rounded-sm");
        segment.style.background = HEALTH_COLORS[s];
        segment.style.opacity = s === state ? "1" : "0.3";
        bar.append(segment);

        const cell = el("div", "flex-1 flex justify-center");
        if (s === state) {
            const arrow = el("span", "material-symbols-outlined text-[18px] leading-none", "arrow_drop_up");
            arrow.style.color = HEALTH_COLORS[s];
            cell.append(arrow);
        }
        marks.append(cell);
    }

    wrap.append(bar, marks);
    return wrap;
}

function warningRow(text) {
    const row = el("div", "flex items-start gap-2 font-data-md text-[12px] leading-snug text-primary-container");
    row.append(el("span", "material-symbols-outlined text-[16px] shrink-0", "warning"), el("span", "", text));
    return row;
}

function eventsList(events) {
    const wrap = el("div", "flex flex-col gap-2");
    wrap.append(el("span", "font-label-caps text-[11px] text-on-surface-variant uppercase", t("analysis.events")));

    const list = el("div", "flex flex-col gap-1.5");
    for (const e of events) {
        const row = el("div", "flex gap-3 font-data-md text-[12px] leading-snug");
        row.append(el("span", "w-11 shrink-0 text-outline text-right", t("analysis.seconds", { value: e.second })));

        const text = el("span", "text-on-surface", eventText(e));
        const color = eventColor(e);
        if (color) text.style.color = color;
        row.append(text);

        list.append(row);
    }

    wrap.append(list);
    return wrap;
}

// onOpenRecommendations(liste): "Öneriler" butonuna basınca
export function createAnalysisCard({ onOpenRecommendations }) {
    const content = $("analysis-content");
    const footer = $("analysis-footer");
    const recsBtn = $("analysis-recs-btn");
    const recsLabel = $("analysis-recs-label");

    let recommendations = [];
    recsBtn.addEventListener("click", () => onOpenRecommendations(recommendations));

    // Tek satırlık mesaj (hazırlanıyor, yüklenemedi, veri yok)
    function message(key, isError = false) {
        content.replaceChildren(el("p", `font-data-md text-[13px] ${isError ? "text-signal-error" : "text-on-surface-variant"}`, t(key)));
        footer.hidden = true;
    }

    function show(analysis, testRun) {
        if (analysis.status === "pending") return message("analysis.pending");
        if (analysis.status !== "ready") return message("analysis.empty");

        const { verdict } = analysis;
        const color = HEALTH_COLORS[verdict.state];
        const nodes = [];

        // Durum ve tahmini kapasite
        const head = el("div", "flex items-start justify-between gap-3");

        const chip = el("span", "flex items-center gap-2 font-label-caps text-label-caps uppercase");
        const dot = el("span", "w-2 h-2 rounded-full");
        dot.style.background = color;
        dot.style.boxShadow = `0 0 6px ${color}`;
        const label = el("span", "", healthLabel(verdict.state));
        label.style.color = color;
        chip.append(dot, label);

        const capacity = el("div", "flex flex-col items-end");
        capacity.append(
            el("span", "font-data-md text-[11px] text-outline", t("analysis.capacity")),
            el("span", "font-headline-md text-headline-md text-on-surface whitespace-nowrap", capacityText(verdict.capacity))
        );

        head.append(chip, capacity);
        nodes.push(head, gauge(verdict.state));

        // Sonuç cümlesi
        nodes.push(el("p", "font-body-md text-[14px] leading-snug text-on-surface", verdictSentence(analysis, testRun.loadProfile === "STEPPED")));

        // Uyarılar
        const recTypes = analysis.recommendations.map((r) => r.type);
        if (analysis.voltaOverloaded) nodes.push(warningRow(t("analysis.voltaOverloaded")));
        if (analysis.stopped) nodes.push(warningRow(t(`analysis.ended.${analysis.endReason}`)));
        if (recTypes.includes("redirects")) nodes.push(warningRow(t("analysis.redirectsNotice")));
        if (recTypes.includes("clientErrors")) nodes.push(warningRow(t("analysis.clientErrorsNotice")));

        // Olaylar
        if (analysis.events.length > 0) nodes.push(eventsList(analysis.events));

        content.replaceChildren(...nodes);

        // Öneriler butonu
        recommendations = analysis.recommendations;
        recsBtn.hidden = recommendations.length === 0;
        recsLabel.textContent = t("analysis.recommendations", { count: recommendations.length });
        footer.hidden = false;
    }

    message("analysis.loading");
    return { show, message };
}