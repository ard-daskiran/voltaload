// Step table (stepped tests only): each step's target, achieved RPS, latency, errors and state.

import { $ } from "../core/dom.js";
import { formatNumber, formatMs, formatPercent } from "../core/i18n.js";
import { latencyLevel } from "../core/latency.js";
import { HEALTH_COLORS, healthLabel } from "../analysis/analysis-text.js";

// Latency color (limits in core/latency.js): normal white, slow yellow, critical red
const LATENCY_CLASSES = {
    none: "text-on-surface-variant",
    normal: "text-on-surface",
    slow: "text-primary-container",
    critical: "text-signal-error",
};

function latencyClass(ms) {
    return LATENCY_CLASSES[latencyLevel(ms)];
}

function td(className, text) {
    const cell = document.createElement("td");
    cell.className = `py-2.5 px-4 ${className}`;
    if (text !== undefined) cell.textContent = text;
    return cell;
}

function stateCell(state) {
    const cell = td("whitespace-nowrap");
    const chip = document.createElement("span");
    chip.className = "inline-flex items-center gap-1.5";

    const dot = document.createElement("span");
    dot.className = "w-1.5 h-1.5 rounded-full";
    dot.style.background = HEALTH_COLORS[state];

    const label = document.createElement("span");
    label.textContent = healthLabel(state);
    label.style.color = HEALTH_COLORS[state];

    chip.append(dot, label);
    cell.append(chip);
    return cell;
}

export function createStepsTable() {
    const section = $("steps-section");
    const body = $("steps-body");

    function show(steps) {
        section.hidden = steps.length === 0;
        if (steps.length === 0) return;

        const rows = steps.map((step) => {
            const tr = document.createElement("tr");
            tr.append(
                td("text-on-surface-variant", String(step.index)),
                td("text-right", `${formatNumber(step.targetRps)} RPS`),
                td("text-right text-primary", `${formatNumber(step.actualRps, 1)} RPS`),
                td(`text-right ${latencyClass(step.avg)}`, formatMs(step.avg)),
                td(`text-right ${latencyClass(step.p95)}`, formatMs(step.p95)),
                td(`text-right ${step.errorRate > 0 ? "text-signal-error" : "text-on-surface"}`, formatPercent(step.errorRate)),
                stateCell(step.state)
            );
            return tr;
        });

        body.replaceChildren(...rows);
    }

    return { show };
}