// Volta's own status: lag and MB/s indicators, and a warning strip when it's under strain.

import { $ } from "../core/dom.js";
import { t, formatNumber } from "../core/i18n.js";

const WARNING_HOLD_MS = 3000; // The warning stays visible this long after the last strain

export function createVoltaStatus() {
    const lagText = $("lag-text");
    const rateText = $("rate-text");
    const warning = $("overload-warning");

    let timer = null;

    function hideWarning() {
        warning.hidden = true;
        clearTimeout(timer);
    }

    function showWarning() {
        warning.hidden = false;
        clearTimeout(timer);
        timer = setTimeout(hideWarning, WARNING_HOLD_MS);
    }

    function update(d) {
        lagText.textContent = t("chart.lag", { ms: formatNumber(d.lagMs) });
        rateText.textContent = t("chart.dataRate", { mb: formatNumber(d.bytesPerSecond / 1_000_000, 1) });
        if (d.voltaOverloaded) showWarning();
    }

    function reset() {
        lagText.textContent = "—";
        rateText.textContent = "—";
        hideWarning();
    }

    reset();
    return { update, reset, hideWarning };
}