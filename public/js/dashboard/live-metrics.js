// Metrik kartları: ortalama, istek, en düşük, en yüksek. Toplamlar ve durum kodu sayıları burada tutulur.

import { $ } from "../core/dom.js";
import { formatNumber } from "../core/i18n.js";

function freshTotals() {
    return { requests: 0, latencySum: 0, latencyCount: 0, min: null, max: null, statusCounts: {} };
}

export function createLiveMetrics() {
    const mAvg = $("m-avg");
    const mAvgLive = $("m-avg-live");
    const mCount = $("m-count");
    const mCountLive = $("m-count-live");
    const mMin = $("m-min");
    const mMinLive = $("m-min-live");
    const mMax = $("m-max");
    const mMaxLive = $("m-max-live");

    let totals = freshTotals();

    function reset() {
        totals = freshTotals();
        for (const el of [mAvg, mAvgLive, mCount, mCountLive, mMin, mMinLive, mMax, mMaxLive]) {
            el.textContent = "—";
        }
    }

    // Her yeni dilimde çağrılır
    function addWindow(d) {
        totals.requests += d.requestCount;

        for (const [code, count] of Object.entries(d.statusCounts)) {
            totals.statusCounts[code] = (totals.statusCounts[code] || 0) + count;
        }

        if (d.latencyCount > 0) {
            // Ağırlıklı ortalama: kalabalık dilimler ortalamaya daha çok etki eder
            totals.latencySum += d.avgResponseTime * d.latencyCount;
            totals.latencyCount += d.latencyCount;
            totals.min = totals.min === null ? d.minResponseTime : Math.min(totals.min, d.minResponseTime);
            totals.max = totals.max === null ? d.maxResponseTime : Math.max(totals.max, d.maxResponseTime);

            mAvg.textContent = formatNumber(Math.round(totals.latencySum / totals.latencyCount));
            mMin.textContent = formatNumber(totals.min);
            mMax.textContent = formatNumber(totals.max);
            mAvgLive.textContent = formatNumber(Math.round(d.avgResponseTime));
            mMinLive.textContent = formatNumber(d.minResponseTime);
            mMaxLive.textContent = formatNumber(d.maxResponseTime);
        } else {
            // Sadece bağlantı hatası olan dilim: gecikme ölçülemedi
            mAvgLive.textContent = "—";
            mMinLive.textContent = "—";
            mMaxLive.textContent = "—";
        }

        mCount.textContent = formatNumber(totals.requests);
    }

    // "İstek" kartının anlık değeri: son biten saniyedeki istek sayısı
    function setLiveRequests(count) {
        mCountLive.textContent = formatNumber(count);
    }

    function getRequests() {
        return totals.requests;
    }

    function getStatusCounts() {
        return totals.statusCounts;
    }

    reset();
    return { reset, addWindow, setLiveRequests, getRequests, getStatusCounts };
}