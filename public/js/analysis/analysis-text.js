// Turns analysis data into sentences, colors and icons. Shared by the detail page and the report.
// The server sends data, not sentences; the sentences are built from the dictionary (for language support).

import { t, formatNumber } from "../core/i18n.js";

// State colors: on the gauge, from worst to best, left to right
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

// "125–250 RPS" (broke down between these two), "≥ 400 RPS" (no limit seen), "< 100 RPS"
export function capacityText(capacity) {
    return t(`capacity.${capacity.kind}`, {
        rps: formatNumber(capacity.rps),
        breakAt: capacity.breakAt !== undefined ? formatNumber(capacity.breakAt) : "",
    });
}

// States ordered by severity (the reverse of the gauge order)
function rank(state) {
    return HEALTH_ORDER.length - 1 - HEALTH_ORDER.indexOf(state);
}

// In a stepped test the sentence describes each worsening in order:
// "The server was healthy up to 100 RPS, started to strain at 200 RPS, was strained at 300 RPS, collapsed at 400 RPS."
function steppedSentence(steps) {
    let healthyCount = 0;
    while (healthyCount < steps.length && steps[healthyCount].state === "HEALTHY") healthyCount++;

    // Each step after the healthy part where the state got worse
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

    // If the first step isn't healthy it starts like "The server started to strain at 100 RPS, ..."
    return `${start}${healthyCount > 0 ? ", " : " "}${parts.join(", ")}.`;
}

// The result's main sentence (without the connection warning)
function baseSentence(analysis, isStepped) {
    const { verdict, steps, recommendations } = analysis;

    if (verdict.slowButStable) {
        const slow = recommendations.find((r) => r.type === "slowButStable");
        if (slow) return t("verdict.slowButStable", { p95: formatNumber(slow.p95) });
    }

    const c = verdict.capacity;
    const rps = formatNumber(c.rps);

    if (isStepped) {
        // "No limit was reached" if all are healthy; "strained even at the first step" if even the first step is beyond capacity
        if (steps.every((s) => s.state === "HEALTHY")) return t("verdict.atLeast", { rps });
        if (c.kind === "below") return t("verdict.belowStepped", { rps });
        return steppedSentence(steps);
    }

    // If it counted toward capacity but latency rose ("Borderline"), don't say "without issues"
    if (c.kind === "atLeast") {
        return t(verdict.state === "HEALTHY" ? "verdict.atLeastConstant" : "verdict.atLeastConstantSlower", { rps });
    }
    return t("verdict.belowConstant", { rps });
}

// Result sentence
export function verdictSentence(analysis, isStepped) {
    const { verdict, recommendations } = analysis;

    // The connection was lost after being healthy: its own sentence already explains what happened
    if (verdict.outage) {
        return t("verdict.outage", { second: verdict.outage.second, rps: formatNumber(verdict.outage.rps) });
    }

    // If the connection was lost it's added to the sentence ("could not handle" alone doesn't explain what happened)
    const sentence = baseSentence(analysis, isStepped);
    const connectionLost = recommendations.some((r) => r.type === "connection");
    return connectionLost ? `${sentence} ${t("verdict.connectionLost")}` : sentence;
}

// --- Events ---
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

// Event color: errors red, latency yellow, recovery cyan, others neutral
export function eventColor(e) {
    switch (e.type) {
        case "errorsStart":
        case "errorPeak":
        case "connectionLost":
            return HEALTH_COLORS.COLLAPSED;
        case "latencyRise":
        case "queueRising":
        case "unhealthyFromStart":
        case "interrupted":
        case "failed":
            return HEALTH_COLORS.BORDERLINE;
        case "recovered":
            return HEALTH_COLORS.HEALTHY;
        default:
            return null;
    }
}

// --- Recommendations ---

// tone: "problem" (red), "warning" (yellow), "action" (cyan, next step)
const REC_STYLE = {
    overload: { icon: "block", tone: "problem" },
    timeouts: { icon: "hourglass_bottom", tone: "problem" },
    tooSlow: { icon: "hourglass_disabled", tone: "problem" },
    serverErrors: { icon: "bug_report", tone: "problem" },
    connection: { icon: "power_off", tone: "problem" },
    tailLatency: { icon: "timeline", tone: "warning" },
    clientErrors: { icon: "rule", tone: "warning" },
    redirects: { icon: "alt_route", tone: "warning" },
    rateLimited: { icon: "front_hand", tone: "warning" },
    slowButStable: { icon: "speed", tone: "warning" },
    lowSample: { icon: "info", tone: "warning" },
    narrowCapacity: { icon: "my_location", tone: "action" },
    findCapacity: { icon: "my_location", tone: "action" },
    nearLimit: { icon: "my_location", tone: "action" },
    noLimitFound: { icon: "trending_up", tone: "action" },
};

export const TONE_COLORS = {
    problem: HEALTH_COLORS.COLLAPSED,
    warning: HEALTH_COLORS.BORDERLINE,
    action: HEALTH_COLORS.HEALTHY,
};

// "Stepped · max 300 RPS · 10 steps · 30s"
export function followUpText(test) {
    return t("rec.followUp", { rps: formatNumber(test.targetRps), steps: test.stepCount, duration: test.duration });
}

// How a recommendation looks: { icon, tone, title, text, test }
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

    // If Volta's upper limit was reached there's no test to suggest; a different explanation
    const textKey = rec.type === "noLimitFound" && !rec.test ? "rec.noLimitFound.maxed" : `rec.${rec.type}.text`;

    return {
        icon: style.icon,
        tone: style.tone,
        title: t(`rec.${rec.type}.title`, params),
        text: t(textKey, params),
        test: rec.test ?? null,
    };
}