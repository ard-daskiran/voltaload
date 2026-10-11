// Grafiğin görsel sabitleri: renkler, çizgi sırası, nokta boyutları, eksen ayarları.

// Veri setlerinin sırası (açıklama satırındaki data-series değerleriyle aynı)
export const SERIES = { AVG: 0, P95: 1, P99: 2, SUCCESS_RPS: 3, SENT_RPS: 4, CONNECTION: 5 };

export const CHART_COLORS = {
    avg: "#f4c21a",
    p95: "#64d8d7",
    p99: "#c4b5fd",
    successRps: "#b8ad96",
    sentRps: "#e1e2eb",
    error: "#ff5555",
    errorFill: "rgba(255, 85, 85, 0.14)",
    muted: "#9a9079",
    tick: "#9a9079",
    grid: "rgba(48, 54, 61, 0.6)",
    background: "#0b0e14",
};

// Tam saniye noktaları: koyu halkalı küçük nokta, üzerine gelince büyür
export const SECOND_DOT = { radius: 3.5, hoverRadius: 6, ring: 1.5 };

// Gecikme ekseni: tavan = en yüksek değer × 1,2. Sadece büyür, büyürken yavaşça kayar.
// Üst sınır 2750: gecikme 2500'ü (timeout) geçemez, 2500 çizgisi tavana yapışmasın.
export const Y_AXIS = { min: 100, cap: 2750, headroom: 1.2, animationMs: 500 };

export const MONO_FONT = { family: "'IBM Plex Mono', monospace", size: 10 };