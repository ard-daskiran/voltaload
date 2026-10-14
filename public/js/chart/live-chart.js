// Canlı grafik: kurulum, dilim ekleme, saniye noktaları, kapanış.
// Görsel sabitler, animasyon, eklentiler, bilgi kutusu ve açıklama satırı ayrı dosyalarda.

import { t, formatNumber } from "../core/i18n.js";
import { statusCategory } from "../status/status-info.js";
import { SERIES, CHART_COLORS, SECOND_DOT, Y_AXIS, MONO_FONT } from "./chart-theme.js";
import { DEFAULT_WINDOW_SECONDS, roundTime, snapToWindow, isSecondMark, xKey, formatTimeTick } from "./chart-time.js";
import { createChartAnimator } from "./chart-animation.js";
import { glowPlugin, crosshairPlugin, createRevealPlugin, avgFill } from "./chart-plugins.js";
import { createChartTooltip } from "./chart-tooltip.js";
import { bindLegend, updateLegendButtons } from "./chart-legend.js";


// --- Durum ---
let liveChart = null;
let tooltip = null;
let windowSeconds = DEFAULT_WINDOW_SECONDS;
let windowMeta = []; // Her dilimin ayrıntıları, gecikme veri setleriyle aynı sırada
let windowIndexByX = new Map(); // "7.4" → windowMeta içindeki sırası
let secondTotals = new Map(); // biten saniye (3) → 2–3 sn arasının istek sayıları
let lastLatency = null; // Son gerçek ortalama (bağlantı hatası çizgisi bu seviyeden devam eder)
let inOutage = false;
let initialMaxSeconds = 10;
let userZoomed = false;
let lastX = 0;

// Kullanıcının açıp kapattığı çizgiler: sayfa açık kaldığı sürece hatırlanır, yeni test grafiği onlarla kurulur.
// Dokunulmayan çizgiler varsayılanda kalır (RPS çizgileri sabit yükte kapalı, kademelide açık).
const visibilityChoice = new Map(); // çizgi → görünür mü
let currentDefaults = null; // mevcut grafiğin varsayılan görünürlükleri

const animator = createChartAnimator();
const revealPlugin = createRevealPlugin(() => animator.revealedX());

// Bilgi kutusu bir zamandaki dilimin bilgilerini buradan alır
function lookup(x) {
    const index = windowIndexByX.get(xKey(x));
    return {
        meta: index !== undefined ? windowMeta[index] : null,
        totals: isSecondMark(x) ? secondTotals.get(Math.round(x)) ?? null : null,
    };
}

// Tam saniye noktalarının görünümü (ortalama ve bağlantı hatası çizgisi ortak kullanır)
function secondDotOptions(shouldShow, colorFor) {
    return {
        pointRadius: (ctx) => (shouldShow(ctx) ? SECOND_DOT.radius : 0),
        pointHoverRadius: (ctx) => (shouldShow(ctx) ? SECOND_DOT.hoverRadius : 0),
        pointBackgroundColor: colorFor,
        pointHoverBackgroundColor: colorFor,
        pointBorderColor: CHART_COLORS.background,
        pointHoverBorderColor: CHART_COLORS.background,
        pointBorderWidth: SECOND_DOT.ring,
        pointHoverBorderWidth: SECOND_DOT.ring,
    };
}

// Yeni bir noktanın yatay eksen ve yakınlaştırma sınırlarına etkisi
function extendRange(x) {
    liveChart.options.plugins.zoom.limits.x.max = Math.max(initialMaxSeconds, x);
    if (!userZoomed && x > liveChart.options.scales.x.max) {
        liveChart.options.scales.x.max = x;
    }
}

// --- Dışarıya açık fonksiyonlar ---

export function createChart(durationSeconds = 10, profileType = "CONSTANT") {
    const canvas = document.getElementById("chart");

    // Eski grafik silinmeden önce: kullanıcının varsayılandan farklı bıraktığı çizgileri hatırla
    if (liveChart && currentDefaults) {
        for (const [series, visibleByDefault] of currentDefaults) {
            const visible = liveChart.isDatasetVisible(series);
            if (visible !== visibleByDefault || visibilityChoice.has(series)) visibilityChoice.set(series, visible);
        }
    }

    if (liveChart) liveChart.destroy();

    if (!tooltip) {
        tooltip = createChartTooltip({ element: document.getElementById("chart-tooltip"), lookup });
    }
    tooltip.reset();
    animator.reset();

    windowSeconds = DEFAULT_WINDOW_SECONDS;
    windowMeta = [];
    windowIndexByX = new Map();
    secondTotals = new Map();
    lastLatency = null;
    inOutage = false;
    userZoomed = false;
    lastX = 0;
    initialMaxSeconds = Math.min(durationSeconds, 10);

    // Kademeli testte RPS çizgileri varsayılan açık (merdiven ve başarılı RPS asıl görüntü)
    const showRps = profileType === "STEPPED";
    currentDefaults = new Map([
        [SERIES.AVG, true],
        [SERIES.P95, true],
        [SERIES.P99, true],
        [SERIES.SUCCESS_RPS, showRps],
        [SERIES.SENT_RPS, showRps],
        [SERIES.CONNECTION, true],
    ]);

    // Kullanıcı seçtiyse onun seçimi, yoksa varsayılan
    const hiddenOf = (series) => !(visibilityChoice.get(series) ?? currentDefaults.get(series));

    const line = (label, color, extra = {}) => ({
        label,
        data: [],
        borderColor: color,
        backgroundColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        // Yumuşak ama ölçülen noktaların dışına taşmayan çizgi
        cubicInterpolationMode: "monotone",
        fill: false,
        spanGaps: false,
        ...extra,
    });

    liveChart = new Chart(canvas, {
        type: "line",
        data: {
            datasets: [
                line(t("chart.series.avg"), CHART_COLORS.avg, {
                    hidden: hiddenOf(SERIES.AVG),
                    borderWidth: 2,
                    fill: "origin",
                    backgroundColor: avgFill,
                    // Sadece tam saniyelerde nokta (o noktada biten saniyenin istek sayısı okunur)
                    ...secondDotOptions(
                        (ctx) => isSecondMark(ctx.raw?.x),
                        (ctx) => (windowMeta[ctx.dataIndex]?.hasError ? CHART_COLORS.error : CHART_COLORS.avg)
                    ),
                    // Hata olan dilime giden parça ve altındaki alan kırmızı
                    segment: {
                        borderColor: (ctx) => (windowMeta[ctx.p1DataIndex]?.hasError ? CHART_COLORS.error : undefined),
                        backgroundColor: (ctx) => (windowMeta[ctx.p1DataIndex]?.hasError ? CHART_COLORS.errorFill : undefined),
                    },
                }),
                line(t("chart.series.p95"), CHART_COLORS.p95, { hidden: hiddenOf(SERIES.P95) }),
                line(t("chart.series.p99"), CHART_COLORS.p99, { hidden: hiddenOf(SERIES.P99) }),
                // Başarılı RPS: sadece tam saniyelerde nokta (her biri o saniyenin tamamı)
                line(t("chart.series.completedRps"), CHART_COLORS.successRps, {
                    yAxisID: "y1",
                    hidden: hiddenOf(SERIES.SUCCESS_RPS),
                    pointRadius: 2,
                    spanGaps: true,
                }),
                line(t("chart.series.sentRps"), CHART_COLORS.sentRps, {
                    yAxisID: "y1",
                    hidden: hiddenOf(SERIES.SENT_RPS),
                    borderDash: [5, 4],
                    borderWidth: 1,
                    stepped: true,
                    pointHoverRadius: 0,
                }),
                line(t("chart.connectionError"), CHART_COLORS.error, {
                    borderWidth: 2,
                    cubicInterpolationMode: "default",
                    // Bağlantı hatası olan tam saniyelerde nokta bu çizginin üzerinde
                    ...secondDotOptions(
                        (ctx) => isSecondMark(ctx.raw?.x) && Boolean(windowMeta[ctx.dataIndex]?.connectionOnly),
                        () => CHART_COLORS.error
                    ),
                }),
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            parsing: false,
            normalized: true,
            // Noktalar animasyonsuz: akış hissini perde ve eksen döngüsü veriyor
            animation: false,
            // Grafiğin her yerinde: farenin yatayda en yakın olduğu an
            interaction: { mode: "nearest", axis: "x", intersect: false },
            onHover: (event, elements, chart) => tooltip.handleHover(event, elements, chart),
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false, external: (context) => tooltip.render(context) },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: "x",
                        // Kullanıcı grafikle oynamaya BAŞLADIĞI anda otomatik kaydırma durur (zıplama olmasın)
                        onPanStart: () => {
                            userZoomed = true;
                            return true;
                        },
                    },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: "x",
                        onZoomStart: () => {
                            userZoomed = true;
                            return true;
                        },
                    },
                    // Uzaklaştırma ve kaydırma verinin bulunduğu aralıkla sınırlı (max her yeni noktada büyür)
                    limits: { x: { min: 0, max: initialMaxSeconds, minRange: 1 } },
                },
            },
            scales: {
                x: {
                    type: "linear",
                    min: 0,
                    max: initialMaxSeconds,
                    ticks: { color: CHART_COLORS.tick, font: MONO_FONT, callback: (v) => formatTimeTick(v, windowSeconds) },
                    grid: { display: false },
                },
                y: {
                    beginAtZero: true,
                    // Tavanı animasyon döngüsü yönetir, Chart.js kendi kendine değiştirmez
                    max: Y_AXIS.min,
                    ticks: {
                        color: CHART_COLORS.tick,
                        font: MONO_FONT,
                        // Sürekli değişen tavanın kendisini (263 gibi) etiket olarak gösterme, sadece düzgün değerler
                        includeBounds: false,
                        callback: (v) => `${formatNumber(Math.round(v))}ms`,
                    },
                    grid: { color: CHART_COLORS.grid },
                },
                y1: {
                    position: "right",
                    beginAtZero: true,
                    // Sadece RPS çizgilerinden biri görünürken eksen gösterilir
                    display: "auto",
                    ticks: { color: CHART_COLORS.successRps, font: MONO_FONT, callback: (v) => `${formatNumber(Math.round(v))} r/s` },
                    grid: { display: false },
                },
            },
        },
        // Sıra önemli: perde önce açılır ve kapanır, kesikli çizgi (crosshair) perdenin dışında kalır
        plugins: [revealPlugin, glowPlugin, crosshairPlugin],
    });

    animator.attach(liveChart);
    updateLegendButtons(liveChart);
}

// Bir dilimi grafiğe ekler. Dilim, BAŞLADIĞI ana konur (0–0,2 arası → 0).
// Noktanın oturduğu zamanı döndürür. Canlı akış ve yeniden bağlanma aynı fonksiyonu kullanır.
export function addWindow(d) {
    if (!liveChart) return null;

    if (d.windowSeconds) windowSeconds = d.windowSeconds;

    const end = snapToWindow(d.elapsedSeconds, windowSeconds);
    let x = roundTime(end - windowSeconds);
    // Zamanlayıcı küçük oynamalarla iki dilimi aynı noktaya oturtursa sonrakini bir adım ileri al
    if (windowMeta.length > 0 && x <= lastX) x = roundTime(lastX + windowSeconds);
    if (x < 0) x = 0;


    // Boş dilim (o 0,2 saniyede hiç cevap gelmedi; düşük RPS'te olağan): gecikme çizgilerine nokta eklenmez,
    // çizgiler bir önceki noktadan sonrakine kesintisiz bağlanır. Grafik yine de düzgün ilerler.
    // (Bağlantı hatası farklı: istek var ama gecikme yok, aşağıda kırmızı çizgiyle gösterilir.)
    if (d.requestCount === 0) {
        liveChart.data.datasets[SERIES.SENT_RPS].data.push({ x, y: d.targetRps });
        lastX = x;
        extendRange(x);
        liveChart.update("none");
        animator.revealTo(x, windowSeconds * 1000, windowMeta.length > 0);
        return x;
    }

    const hasLatency = d.avgResponseTime !== null;
    const index = windowMeta.length;

    windowMeta.push({
        x,
        avg: d.avgResponseTime,
        p95: d.p95ResponseTime,
        p99: d.p99ResponseTime,
        hasError: d.errorCount > 0,
        errorCodes: Object.keys(d.statusCounts).filter((code) => statusCategory(code) === "serverError"),
        connectionOnly: !hasLatency,
    });
    windowIndexByX.set(xKey(x), index);

    const ds = liveChart.data.datasets;
    ds[SERIES.AVG].data.push({ x, y: hasLatency ? d.avgResponseTime : null });
    ds[SERIES.P95].data.push({ x, y: d.p95ResponseTime });
    ds[SERIES.P99].data.push({ x, y: d.p99ResponseTime });
    ds[SERIES.SENT_RPS].data.push({ x, y: d.targetRps });

    // Bağlantı hatası çizgisi: son gerçek değerden düz devam eder, bağlantı gelince yeni değere bağlanır
    const conn = ds[SERIES.CONNECTION].data;

    if (!hasLatency) {
        const level = lastLatency ?? 0;
        // Kesinti yeni başladıysa kırmızı çizgi bir önceki (son gerçek) noktadan başlasın
        if (!inOutage && index > 0 && lastLatency !== null) {
            conn[index - 1] = { x: conn[index - 1].x, y: level };
        }
        conn.push({ x, y: level });
        inOutage = true;
    } else {
        conn.push({ x, y: inOutage ? d.avgResponseTime : null });
        inOutage = false;
        lastLatency = d.avgResponseTime;
    }

    lastX = x;
    extendRange(x);
    animator.growYAxis(Math.max(d.avgResponseTime ?? 0, d.p95ResponseTime ?? 0, d.p99ResponseTime ?? 0));
    liveChart.options.scales.y.max = animator.currentYAxisMax();
    liveChart.update("none");
    animator.revealTo(x, windowSeconds * 1000, windowMeta.length > 1);
    return x;
}

// Biten bir saniyenin istek sayılarını kaydeder. Nokta saniyenin BİTTİĞİ yere konur (0–1 arası → 1).
// Ekrana bir sonraki dilimle birlikte çizilir.
export function addSecondPoint(endSecond, totals) {
    if (!liveChart) return;

    secondTotals.set(endSecond, { ...totals, second: endSecond });
    liveChart.data.datasets[SERIES.SUCCESS_RPS].data.push({ x: endSecond, y: totals.success });
}

// Test bitince çizgiyi son dilimin bitiş anına kadar uzatır (10 sn'lik test 10'da biter, 9,8'de değil).
// Yeni bir ölçüm değil: son dilimin aynı değerleri, sadece dilimin sonunu gösterir.
export function closeChart() {
    if (!liveChart || windowMeta.length === 0) return;

    const last = windowMeta[windowMeta.length - 1];
    const endX = roundTime(last.x + windowSeconds);
    // Son dolu dilimden sonra boş dilimler geldiyse grafik zaten oraya kadar ilerledi
    if (windowIndexByX.has(xKey(endX)) || endX <= lastX) return;

    const index = windowMeta.length;
    windowMeta.push({ ...last, x: endX });
    windowIndexByX.set(xKey(endX), index);

    const ds = liveChart.data.datasets;
    for (const series of [SERIES.AVG, SERIES.P95, SERIES.P99, SERIES.SENT_RPS, SERIES.CONNECTION]) {
        const data = ds[series].data;
        const previous = data[data.length - 1];
        data.push({ x: endX, y: previous?.y ?? null });
    }

    lastX = endX;
    extendRange(endX);
    liveChart.update("none");
    animator.revealTo(endX, windowSeconds * 1000, true);
}

export function resetChartZoom() {
    if (!liveChart) return;

    userZoomed = false;
    liveChart.options.scales.x.min = 0;
    liveChart.options.scales.x.max = Math.max(initialMaxSeconds, lastX);
    liveChart.update("none");
}

// Açıklama satırının butonlarını bağla (sayfa açılışında bir kez)
export function initLegend() {
    bindLegend(() => liveChart);
}