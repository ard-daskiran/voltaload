// Zamanla ilgili yardımcılar: dilimlere oturtma, tam saniye kontrolü, eksen etiketleri.

import { formatNumber } from "../core/i18n.js";

// Dilim süresi sunucudan gelir (config.ts → LIVE_WINDOW_MS). Bu sadece ilk paket gelene kadarki varsayılan.
export const DEFAULT_WINDOW_SECONDS = 0.2;

// Ondalık hesaplardaki küçük kaymaları temizler (0,30000000004 → 0,3)
export function roundTime(value) {
    return Number(value.toFixed(3));
}

// Zamanı dilim süresinin katına oturt (0,2 sn'de: 0 · 0,2 · 0,4 ...)
export function snapToWindow(seconds, windowSeconds) {
    return roundTime(Math.round(seconds / windowSeconds) * windowSeconds);
}

export function isWholeSecond(x) {
    return x !== undefined && x !== null && Math.abs(x - Math.round(x)) < 1e-6;
}

// Tam saniye noktası mı? 0 hariç (0'da henüz biten bir saniye yok)
export function isSecondMark(x) {
    return isWholeSecond(x) && x > 0;
}

// Zamanı sözlük anahtarına çevir ("7.4")
export function xKey(x) {
    return x.toFixed(1);
}

// Zaman ekseni etiketi:
//   tam saniye        → "1s", "2s"
//   noktaya denk gelen ara değer (dilim süresinin katı) → "1,2s", "1,4s"  (sadece yakınlaştırınca görünür)
//   hiçbir noktaya denk gelmeyen değer (1,25 gibi) → boş
// Böylece aynı etiket hiçbir zaman iki kez yazılmaz.
export function formatTimeTick(value, windowSeconds) {
    if (isWholeSecond(value)) return `${formatNumber(Math.round(value), 0)}s`;

    const steps = value / windowSeconds;
    if (Math.abs(steps - Math.round(steps)) < 1e-6) return `${formatNumber(value, 1)}s`;

    return "";
}