// history-table.js
// Geçmiş tablosunun satırları.

import { t, formatNumber, formatMs, getLocale } from "../core/i18n.js";
import { runStatusStyle, runStatusLabel } from "../status/run-status.js";
import { latencyLevel } from "../core/latency.js";
import { el } from "../core/dom.js";
import { shortUrl } from "../core/url.js";


const COLUMN_COUNT = 7;

// Ortalama gecikme rengi (sınırlar core/latency.js'te): normal cyan, yavaş sarı, kritik kırmızı
const LATENCY_CLASSES = {
    none: "text-on-surface-variant",
    normal: "text-secondary",
    slow: "text-primary-container",
    critical: "text-signal-error",
};


function td(className, ...children) {
    const cell = el("td", `py-3.5 px-4 ${className}`);
    cell.append(...children);
    return cell;
}

function dateCell(iso) {
    const d = new Date(iso);
    const locale = getLocale();
    return td(
        "whitespace-nowrap text-[13px] border-l-2 border-transparent group-hover:border-secondary",
        el("span", "text-on-surface font-medium", d.toLocaleDateString(locale)),
        " ",
        el("span", "text-on-surface-variant/70", d.toLocaleTimeString(locale))
    );
}

// Hedef: rehberde kayıtlıysa üstte isim, altında küçük URL. Değilse sadece URL.
// Kopyalama her zaman URL'yi kopyalar ve satırın tıklamasını tetiklemez (detay sayfası açılmaz).
function urlCell(run) {
    const wrap = el("div", "flex items-center gap-2 max-w-[360px]");

    const text = el("div", "min-w-0 flex flex-col");
    if (run.targetName) {
        text.append(
            el("span", "truncate text-[13px] text-on-surface font-semibold", run.targetName),
            el("span", "truncate text-[11px] text-on-surface-variant/60", shortUrl(run.url))
        );
    } else {
        text.append(el("span", "truncate text-[13px] text-on-surface", run.url));
    }
    text.title = run.url;

    const copy = el("button", "shrink-0 text-on-surface-variant/40 hover:text-on-surface transition-colors");
    copy.type = "button";
    copy.title = t("history.copyUrl");
    const icon = el("span", "material-symbols-outlined text-[14px] block", "content_copy");
    copy.append(icon);

    copy.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(run.url);
            icon.textContent = "check";
            setTimeout(() => (icon.textContent = "content_copy"), 1500);
        } catch (err) {
            console.error("Kopyalanamadı:", err);
        }
    });

    wrap.append(text, copy);
    return td("", wrap);
}

function methodCell(method) {
    const style =
        method === "POST"
            ? "bg-primary-container/15 text-primary-container border-primary-container/30"
            : "bg-secondary-container/15 text-secondary border-secondary/30";
    return td("text-center", el("span", `inline-block px-2 py-0.5 rounded font-label-caps text-[11px] font-bold border ${style}`, method));
}

function latencyCell(run) {
    if (run.avgResponseTime === null) return td("text-right text-on-surface-variant", "—");

    const avg = el("span", `font-semibold ${LATENCY_CLASSES[latencyLevel(run.avgResponseTime)]}`, formatMs(run.avgResponseTime));
    const p95 = el("span", "block text-[11px] text-on-surface-variant/60", t("history.p95", { value: formatMs(run.p95) }));
    return td("text-right", avg, p95);
}

function rpsCell(run) {
    const seconds = (run.actualDurationMs ?? 0) / 1000;
    if (!run.totalRequests || seconds <= 0) return td("text-right text-on-surface-variant", "—");

    return td(
        "text-right whitespace-nowrap",
        el("span", "text-primary font-bold", formatNumber(Math.round(run.totalRequests / seconds))),
        " ",
        el("span", "text-on-surface-variant text-[12px]", "req/s")
    );
}

function durationCell(run) {
    const text = run.totalRequests && run.actualDurationMs
        ? t("detail.seconds", { value: formatNumber(run.actualDurationMs / 1000, 1) })
        : "—";
    return td("text-right text-on-surface-variant whitespace-nowrap", text);
}

function statusCell(status) {
    const style = runStatusStyle(status);
    const chip = el(
        "span",
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container border border-border-subtle font-label-caps text-[10px] uppercase whitespace-nowrap"
    );
    chip.append(el("span", `w-1.5 h-1.5 rounded-full block ${style.dot}`), el("span", style.text, runStatusLabel(status)));
    return td("text-center", chip);
}

export function createHistoryTable(tbody) {
    // Tek satırlık mesaj (yükleniyor, boş, hata)
    function showMessage(text, isError = false) {
        const cell = el("td", `py-8 px-4 text-center ${isError ? "text-signal-error" : "text-on-surface-variant"}`, text);
        cell.colSpan = COLUMN_COUNT;
        const row = el("tr");
        row.append(cell);
        tbody.replaceChildren(row);
    }

    // onOpen(run, event): satıra tıklanınca
    function render(items, onOpen) {
        const rows = items.map((run) => {
            const tr = el("tr", "group hover:bg-secondary/10 transition-colors cursor-pointer");
            tr.dataset.runId = run.id;
            tr.append(dateCell(run.createdAt), urlCell(run), methodCell(run.method), latencyCell(run), rpsCell(run), durationCell(run), statusCell(run.status));
            tr.addEventListener("click", (e) => onOpen(run, e));
            return tr;
        });
        tbody.replaceChildren(...rows);
    }

    return { render, showMessage };
}