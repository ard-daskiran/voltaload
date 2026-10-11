// Gecikme seviyeleri. Geçmiş listesi, kademe tablosu ve rapor aynı sınırları kullanır.
// Sınırlar burada, renkler her yerin kendisinde (koyu tema / beyaz kâğıt farklı).

const SLOW_MS = 500;
const CRITICAL_MS = 1000;

// "none" (veri yok) · "normal" · "slow" (500 ms ve üstü) · "critical" (1 saniye ve üstü)
export function latencyLevel(ms) {
    if (ms === null || ms === undefined) return "none";
    if (ms >= CRITICAL_MS) return "critical";
    if (ms >= SLOW_MS) return "slow";
    return "normal";
}