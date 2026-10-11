// Saniyelik toplama: 0,2 sn'lik dilimleri biriktirir, bir saniye dolunca onSecond'u çağırır.
// 0 · 0,2 · 0,4 · 0,6 · 0,8 → 1. saniye (0–1 arası)

import { DEFAULT_WINDOW_SECONDS, roundTime, isWholeSecond } from "../chart/chart-time.js";
import { statusCategory } from "../status/status-info.js";

function freshSecond(start) {
    return {
        start,
        total: 0,
        success: 0,
        errors: 0,
        latencySum: 0,
        latencyCount: 0,
        max: null,
        statusCounts: {},
        targetSum: 0, // Dilimlerin hedef RPS'lerinin toplamı (ortalaması saniyenin hedefi)
        windowCount: 0,
    };
}

// onSecond(endSecond, saniye): biten saniyenin numarası (1, 2, 3...) ve toplamları
export function createSecondAggregator({ onSecond }) {
    let current = freshSecond(0);
    let lastTarget = 0;

    function finalize(s) {
        const errorCodes = Object.keys(s.statusCounts).filter((code) => statusCategory(code) === "serverError");

        // Hiç dilim gelmediyse hedef değişmemiştir, bir öncekini kullan
        const target = s.windowCount > 0 ? Math.round(s.targetSum / s.windowCount) : lastTarget;
        lastTarget = target;

        onSecond(s.start + 1, { ...s, errorCodes, target });
    }

    // x: dilimin grafikteki başlangıç zamanı
    function add(x, d) {
        const width = d.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
        const start = Math.floor(x + 1e-6);

        // Hiç dilimi gelmeyen saniyeler atlanmasın: 0 istek olarak kapat
        while (current.start < start) {
            finalize(current);
            current = freshSecond(current.start + 1);
        }

        const s = current;
        s.total += d.requestCount;
        s.success += d.successCount ?? 0;
        s.errors += d.errorCount;
        s.targetSum += d.targetRps ?? 0;
        s.windowCount++;
        if (d.latencyCount > 0) {
            s.latencySum += d.avgResponseTime * d.latencyCount;
            s.latencyCount += d.latencyCount;
            s.max = s.max === null ? d.maxResponseTime : Math.max(s.max, d.maxResponseTime);
        }
        for (const [code, count] of Object.entries(d.statusCounts)) {
            s.statusCounts[code] = (s.statusCounts[code] || 0) + count;
        }

        // Dilim tam saniyede bitiyorsa (0,8 + 0,2 = 1,0) saniye tamamlandı
        if (isWholeSecond(roundTime(x + width))) {
            finalize(current);
            current = freshSecond(start + 1);
        }
    }

    // Test bittiğinde yarım kalan saniye varsa onu da kapat (süre dolduktan sonra gelen son cevaplar)
    function flush() {
        if (current.total > 0) {
            finalize(current);
            current = freshSecond(current.start + 1);
        }
    }

    function reset() {
        current = freshSecond(0);
        lastTarget = 0;
    }

    return { add, flush, reset };
}