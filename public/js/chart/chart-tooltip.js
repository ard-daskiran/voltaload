// Grafiğin bilgi kutusu: fareye en yakın çizgi vurgulanır, tam saniyelerde istek sayıları da görünür.

import { t, formatNumber, formatMs } from "../core/i18n.js";
import { SERIES, CHART_COLORS } from "./chart-theme.js";
import { roundTime } from "./chart-time.js";

// Bir satır: renkli nokta, ad ve değer. Vurgulanan satır kendi renginde ve kalın.
function tooltipRow(label, value, color, active) {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between gap-4";
    row.style.color = active ? color : CHART_COLORS.muted;
    if (active) row.classList.add("font-semibold");

    const left = document.createElement("span");
    left.className = "flex items-center gap-2";

    const dot = document.createElement("span");
    dot.className = "inline-block w-2 h-2 rounded-full";
    dot.style.background = color;
    dot.style.opacity = active ? "1" : "0.5";

    const name = document.createElement("span");
    name.textContent = label;
    left.append(dot, name);

    const val = document.createElement("span");
    val.textContent = value;

    row.append(left, val);
    return row;
}

function plainRow(text, color, extraClass = "") {
    const row = document.createElement("div");
    row.className = extraClass;
    row.style.color = color;
    row.textContent = text;
    return row;
}

function buildContent(x, meta, totals, highlighted) {
    const nodes = [];

    const title = document.createElement("div");
    title.className = "text-on-surface mb-1";
    title.textContent = t("chart.tooltip.time", { value: formatNumber(x, 1) });
    nodes.push(title);

    // Dilimin gecikmeleri (istek sayısı burada gösterilmez, yanlış anlaşılmasın)
    if (meta?.connectionOnly) {
        nodes.push(plainRow(t("chart.connectionError"), CHART_COLORS.error, "font-semibold"));
    } else if (meta) {
        nodes.push(
            tooltipRow(t("chart.series.avg"), formatMs(meta.avg), CHART_COLORS.avg, highlighted === SERIES.AVG),
            tooltipRow(t("chart.series.p95"), formatMs(meta.p95), CHART_COLORS.p95, highlighted === SERIES.P95),
            tooltipRow(t("chart.series.p99"), formatMs(meta.p99), CHART_COLORS.p99, highlighted === SERIES.P99)
        );

        // Tam saniye değilse hata sadece kodlarla (sayı yok), tam saniyede aşağıda sayıyla yazılır
        if (meta.hasError && !totals) {
            nodes.push(plainRow(`${t("chart.tooltip.errors")}: ${meta.errorCodes.join(", ")}`, CHART_COLORS.error, "mt-1"));
        }
    }

    // Tam saniye: biten saniyenin istek sayıları (1,0'da → 1. saniye, yani 0–1 arası)
    //   Gönderilen: Volta'nın o saniyedeki hedefi
    //   Cevap gelen: sunucudan dönen her cevap, hatalılar dahil (önceki saniyelerden kalanlar da düşebilir)
    //   Başarılı: hatasız cevaplar
    // Üçü eşitse sunucu yetişiyor; aralarındaki fark açıldıkça zorlanıyor.
    if (totals) {
        const separator = document.createElement("div");
        separator.className = "mt-1 pt-1 border-t border-border-subtle";
        nodes.push(separator);


        if (totals.target !== undefined) {
            nodes.push(tooltipRow(t("chart.tooltip.sent"), formatNumber(totals.target), CHART_COLORS.sentRps, false));
        }
        nodes.push(tooltipRow(t("chart.tooltip.received"), formatNumber(totals.total), CHART_COLORS.muted, false));
        nodes.push(
            tooltipRow(
                t("chart.tooltip.success"),
                formatNumber(totals.success),
                CHART_COLORS.successRps,
                highlighted === SERIES.SUCCESS_RPS
            )
        );

        if (totals.errors > 0) {
            nodes.push(
                plainRow(
                    `${t("chart.tooltip.errors")}: ${formatNumber(totals.errors)} (${totals.errorCodes.join(", ")})`,
                    CHART_COLORS.error
                )
            );
        }
    }

    return nodes;
}

// Bilgi kutusunu kurar.
//   element: kutunun HTML öğesi
//   lookup(x): o zamandaki dilimin bilgilerini { meta, totals } olarak döndüren fonksiyon
export function createChartTooltip({ element, lookup }) {
    let lastMouseY = null;

    // Fareye dikeyde en yakın görünür çizgiyi bul (o satır vurgulanır)
    function pickHighlighted(chart, meta, totals) {
        if (lastMouseY === null) return SERIES.AVG;

        const candidates = [];

        if (meta && !meta.connectionOnly) {
            const latencyValues = [
                [SERIES.AVG, meta.avg],
                [SERIES.P95, meta.p95],
                [SERIES.P99, meta.p99],
            ];
            for (const [series, value] of latencyValues) {
                if (value !== null && chart.isDatasetVisible(series)) {
                    candidates.push({ series, pixel: chart.scales.y.getPixelForValue(value) });
                }
            }
        }

        if (totals && chart.isDatasetVisible(SERIES.SUCCESS_RPS) && chart.scales.y1) {
            candidates.push({ series: SERIES.SUCCESS_RPS, pixel: chart.scales.y1.getPixelForValue(totals.success) });
        }

        if (candidates.length === 0) return SERIES.AVG;

        candidates.sort((a, b) => Math.abs(a.pixel - lastMouseY) - Math.abs(b.pixel - lastMouseY));
        return candidates[0].series;
    }

    // Chart.js'in "external" bilgi kutusu fonksiyonu
    function render({ chart, tooltip }) {
        if (tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
            element.hidden = true;
            return;
        }

        const x = roundTime(tooltip.dataPoints[0].parsed.x);
        const { meta, totals } = lookup(x);

        if (!meta && !totals) {
            element.hidden = true;
            return;
        }

        const highlighted = pickHighlighted(chart, meta, totals);
        element.replaceChildren(...buildContent(x, meta, totals, highlighted));
        element.hidden = false;

        // Konum: noktanın sağında, sığmazsa solunda. Dikeyde farenin yanında, grafik alanının içinde.
        const gap = 14;
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        const area = chart.chartArea;

        let left = tooltip.caretX + gap;
        if (left + width > chart.width) left = tooltip.caretX - width - gap;

        const anchorY = lastMouseY ?? tooltip.caretY;
        const top = Math.max(area.top, Math.min(anchorY - height / 2, area.bottom - height));

        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
    }

    // Fare dikeyde hareket edince vurgulanan çizgi değişsin
    function handleHover(event, _elements, chart) {
        lastMouseY = event.y;
        if (chart.tooltip?.opacity > 0) render({ chart, tooltip: chart.tooltip });
    }

    function reset() {
        lastMouseY = null;
        element.hidden = true;
    }

    return { render, handleHover, reset };
}