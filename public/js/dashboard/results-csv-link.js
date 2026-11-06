// results-csv-link.js
// The small CSV link next to the form's title, for a test with variables that has ended (completed or stopped).
//   - pending: the test has ended but its results may still be being written; faded, not clickable, with a tooltip
//   - ready:   all results are in the database (the server sends "done" after the last write); downloads the CSV
// Hidden while a test runs and after a failed one.

import { t, getLanguage } from "../core/i18n.js";

export function createResultsCsvLink(link) {
    let isReady = false;

    function setDisabled(disabled) {
        link.setAttribute("aria-disabled", String(disabled));
        link.classList.toggle("opacity-40", disabled);
        link.classList.toggle("cursor-not-allowed", disabled);
        // Not pointer-events-none: the tooltip has to show on hover
        link.classList.toggle("hover:bg-secondary/10", !disabled);
    }

    // A disabled link doesn't navigate
    link.addEventListener("click", (e) => {
        if (link.getAttribute("aria-disabled") === "true") e.preventDefault();
    });

    function hide() {
        isReady = false;
        link.hidden = true;
        link.removeAttribute("href");
    }

    // Ignored once ready: the stop request's answer can arrive after "done"
    function pending() {
        if (isReady) return;
        link.removeAttribute("href");
        link.title = t("dashboard.csvPending");
        setDisabled(true);
        link.hidden = false;
    }

    // In Turkish Excel expects ";" between columns (the comma is the decimal separator), in English a comma
    function ready(testRunId) {
        const separator = getLanguage() === "tr" ? "semicolon" : "comma";
        link.href = `/api/test-run/${encodeURIComponent(testRunId)}/results.csv?sep=${separator}`;
        isReady = true;
        link.title = t("detail.csvTitle");
        setDisabled(false);
        link.hidden = false;
    }

    hide();
    return { hide, pending, ready };
}
