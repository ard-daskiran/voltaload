// Request log: each row is a summary of one second.

import { t, formatNumber, formatMs } from "../core/i18n.js";
import { createSpan } from "../core/dom.js";
import { statusStyle, sortStatusCodes } from "../status/status-info.js";

const MAX_LOG_LINES = 300;

export function createRequestLog(container) {
    function reset() {
        container.innerHTML = "";
    }

    function appendSecond(endSecond, s) {
        const line = document.createElement("div");
        line.className = "flex gap-3 flex-wrap";

        line.append(
            createSpan(`[${t("log.second", { n: endSecond })}]`, "text-outline"),
            createSpan(`${formatNumber(s.total)} req`, "text-on-surface-variant")
        );

        if (s.latencyCount > 0) {
            line.append(
                createSpan(`avg ${formatMs(s.latencySum / s.latencyCount)}`, s.errors > 0 ? "text-signal-error" : "text-secondary"),
                createSpan(`max ${formatMs(s.max)}`, "text-outline")
            );
        } else if (s.total > 0) {
            line.append(createSpan(t("chart.connectionError"), "text-signal-error"));
        }

        for (const code of sortStatusCodes(Object.keys(s.statusCounts))) {
            line.append(createSpan(`${code}×${formatNumber(s.statusCounts[code])}`, statusStyle(code).text));
        }

        container.appendChild(line);

        while (container.children.length > MAX_LOG_LINES) {
            container.removeChild(container.firstChild);
        }

        container.scrollTop = container.scrollHeight;
    }

    reset();
    return { reset, appendSecond };
}