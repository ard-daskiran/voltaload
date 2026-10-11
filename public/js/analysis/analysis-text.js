// Analiz verisini cümlelere, renklere ve simgelere çevirir. Detay sayfası ve rapor ortak kullanır.
// Sunucu cümle göndermez, sadece veri gönderir; cümleler sözlükten kurulur (dil desteği için).

import { t, formatNumber } from "../core/i18n.js";

// Durum renkleri: göstergede soldan sağa en kötüden en iyiye
export const HEALTH_COLORS = {
    HEALTHY: "#64d8d7",
    BORDERLINE: "#f4c21a",
    STRAINED: "#fb923c",
    COLLAPSED: "#ff5555",
};
export const HEALTH_ORDER = ["COLLAPSED", "STRAINED", "BORDERLINE", "HEALTHY"];

export function healthLabel(state) {
    return t(`health.${state}`);
}

// "125–250 RPS" (bu ikisinin arasında bozuldu), "≥ 400 RPS" (sınır görülmedi), "< 100 RPS"
export function capacityText(capacity) {
    return t(`capacity.${capacity.kind}`, {
        rps: formatNumber(capacity.rps),
        breakAt: capacity.breakAt !== undefined ? formatNumber(capacity.breakAt) : "",
    });
}

// Durumların kötülük sırası (göstergedeki sıranın tersi)
function rank(state) {
    return HEALTH_ORDER.length - 1 - HEALTH_ORDER.indexOf(state);
}

// Kademeli testte cümle, her kötüleşmeyi sırayla anlatır:
// "Sunucu 100 RPS'e kadar sağlıklı çalıştı, 200 RPS'te zorlanmaya başladı, 300 RPS'te zorlandı, 400 RPS'te çöktü."
function steppedSentence(steps) {
    let healthyCount = 0;
    while (healthyCount < steps.length && steps[healthyCount].state === "HEALTHY") healthyCount++;

    // Sağlıklı kısımdan sonra durumun her kötüleştiği kademe
    const parts = [];
    let worstSoFar = "HEALTHY";
    for (const step of steps.slice(healthyCount)) {
        if (rank(step.state) > rank(worstSoFar)) {
            parts.push(t("verdict.part", { rps: formatNumber(step.targetRps), verb: t(`verb.${step.state}`) }));
            worstSoFar = step.state;
        }
    }

    const start =
        healthyCount > 0
            ? t("verdict.healthyUpTo", { rps: formatNumber(steps[healthyCount - 1].targetRps) })
            : t("verdict.subject");

    // İlk kademe sağlıklı değilse "Sunucu 100 RPS'te zorlanmaya başladı, ..." şeklinde başlar
    return `${start}${healthyCount > 0 ? ", " : " "}${parts.join(", ")}.`;
}

// Sonucun ana cümlesi (bağlantı uyarısı eklenmeden)
function baseSentence(analysis, isStepped) {
    const { verdict, steps, recommendations } = analysis;

    if (verdict.slowButStable) {
        const slow = recommendations.find((r) => r.type === "slowButStable");
        if (slow) return t("verdict.slowButStable", { p95: formatNumber(slow.p95) });
    }

    const c = verdict.capacity;
    const rps = formatNumber(c.rps);

    if (isStepped) {
        // Hepsi sağlıklıysa "sınır görülmedi", ilk kademe bile kapasite dışıysa "ilk kademede zorlandı"
        if (steps.every((s) => s.state === "HEALTHY")) return t("verdict.atLeast", { rps });
        if (c.kind === "below") return t("verdict.belowStepped", { rps });
        return steppedSentence(steps);
    }

    return t(c.kind === "atLeast" ? "verdict.atLeastConstant" : "verdict.belowConstant", { rps });
}

// Sonuç cümlesi
export function verdictSentence(analysis, isStepped) {
    const { verdict, recommendations } = analysis;

    // Bağlantı koptu, öncesinde sağlıklıydı: ne olduğunu kendi cümlesi zaten anlatıyor
    if (verdict.outage) {
        return t("verdict.outage", { second: verdict.outage.second, rps: formatNumber(verdict.outage.rps) });
    }

    // Bağlantı koptuysa cümleye eklenir ("karşılayamadı" tek başına ne olduğunu anlatmaz)
    const sentence = baseSentence(analysis, isStepped);
    const connectionLost = recommendations.some((r) => r.type === "connection");
    return connectionLost ? `${sentence} ${t("verdict.connectionLost")}` : sentence;
}
// --- Olaylar ---

export function eventText(e) {
    switch (e.type) {
        case "start":
            return t("event.start", { rps: formatNumber(e.rps) });
        case "step":
            return t("event.step", { index: e.index, rps: formatNumber(e.rps) });
        case "latencyRise":
        case "queueRising":
            return t(`event.${e.type}`, { from: formatNumber(e.from), to: formatNumber(e.to) });
        case "errorsStart":
            return t("event.errorsStart", { codes: e.codes.join(", ") });
        case "errorPeak":
            return t("event.errorPeak", { rate: formatNumber(e.rate * 100, 0) });
        default:
            return t(`event.${e.type}`);
    }
}

// Olayın rengi: hatalar kırmızı, gecikme sarı, toparlanma cyan, diğerleri nötr
export function eventColor(e) {
    switch (e.type) {
        case "errorsStart":
        case "errorPeak":
        case "connectionLost":
            return HEALTH_COLORS.COLLAPSED;
        case "latencyRise":
        case "queueRising":
        case "unhealthyFromStart":
            return HEALTH_COLORS.BORDERLINE;
        case "recovered":
            return HEALTH_COLORS.HEALTHY;
        default:
            return null;
    }
}

// --- Öneriler ---

// tone: "problem" (kırmızı), "warning" (sarı), "action" (cyan, sonraki adım)
const REC_STYLE = {
    overload: { icon: "block", tone: "problem" },
    timeouts: { icon: "hourglass_bottom", tone: "problem" },
    tooSlow: { icon: "hourglass_disabled", tone: "problem" },
    serverErrors: { icon: "bug_report", tone: "problem" },
    connection: { icon: "power_off", tone: "problem" },
    tailLatency: { icon: "timeline", tone: "warning" },
    clientErrors: { icon: "rule", tone: "warning" },
    redirects: { icon: "alt_route", tone: "warning" },
    slowButStable: { icon: "speed", tone: "warning" },
    lowSample: { icon: "info", tone: "warning" },
    narrowCapacity: { icon: "my_location", tone: "action" },
    findCapacity: { icon: "my_location", tone: "action" },
    noLimitFound: { icon: "trending_up", tone: "action" },
};

export const TONE_COLORS = {
    problem: HEALTH_COLORS.COLLAPSED,
    warning: HEALTH_COLORS.BORDERLINE,
    action: HEALTH_COLORS.HEALTHY,
};

// "Kademeli · maks. 300 RPS · 10 kademe · 30 sn"
export function followUpText(test) {
    return t("rec.followUp", { rps: formatNumber(test.targetRps), steps: test.stepCount, duration: test.duration });
}

// Bir önerinin görünümü: { icon, tone, title, text, test }
export function recommendationView(rec) {
    const style = REC_STYLE[rec.type] ?? { icon: "info", tone: "warning" };
    const percent = (share) => formatNumber(share * 100, 0);

    const params = {
        codes: rec.codes?.join(", "),
        share: rec.share !== undefined ? percent(rec.share) : undefined,
        p95: rec.p95 !== undefined ? formatNumber(rec.p95) : undefined,
        p99: rec.p99 !== undefined ? formatNumber(rec.p99) : undefined,
        rps: rec.rps !== undefined ? formatNumber(rec.rps) : undefined,
        from: rec.from !== undefined ? formatNumber(rec.from) : undefined,
        to: rec.to !== undefined ? formatNumber(rec.to) : undefined,
    };

    // Volta'nın üst sınırına ulaşıldıysa önerilecek test yok, farklı bir açıklama
    const textKey = rec.type === "noLimitFound" && !rec.test ? "rec.noLimitFound.maxed" : `rec.${rec.type}.text`;

    return {
        icon: style.icon,
        tone: style.tone,
        title: t(`rec.${rec.type}.title`, params),
        text: t(textKey, params),
        test: rec.test ?? null,
    };
}