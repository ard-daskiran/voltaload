// save-suggestion.js
// The "save this address to your targets?" suggestion after a test ends.
// Rules:
//   - Shown if the URL isn't in the target book and has been tested at least MIN_RUNS times (this test included)
//   - If the answer is "No", it's never asked again for that URL (stored in the browser)
//   - If there's no answer it disappears after 10 s and may be asked again on the next test

import { t } from "../core/i18n.js";
import { showToast } from "../core/toast.js";
import { shortUrl } from "../core/url.js";

const MIN_RUNS = 2; // If set to 1, it asks on the first test too
const SUGGEST_DURATION_MS = 10_000;
const DISMISSED_KEY = "volta-dismissed-suggestions";
const MAX_DISMISSED = 200;

function readDismissed() {
    try {
        const list = JSON.parse(localStorage.getItem(DISMISSED_KEY));
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function dismiss(url) {
    try {
        const list = readDismissed().filter((u) => u !== url);
        list.push(url);
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(list.slice(-MAX_DISMISSED)));
    } catch {
        // If browser storage isn't available, it just closes this time
    }
}

// onSave(url): when "Save" is clicked (opens the target book with the add form)
export function createSaveSuggestion({ onSave }) {
    async function maybeSuggest(url) {
        if (!url || readDismissed().includes(url)) return;

        try {
            const response = await fetch(`/api/targets/suggest?url=${encodeURIComponent(url)}`);
            if (!response.ok) return;

            const { saved, runCount } = await response.json();
            if (saved || runCount < MIN_RUNS) return;

            showToast(t("suggest.title"), {
                detail: shortUrl(url),
                type: "info",
                durationMs: SUGGEST_DURATION_MS,
                actions: [
                    { label: t("suggest.no"), onClick: () => dismiss(url) },
                    { label: t("suggest.save"), primary: true, onClick: () => onSave(url) },
                ],
            });
        } catch (err) {
            // The suggestion is an optional convenience; skip silently on error
            console.error(err);
        }
    }

    return { maybeSuggest };
}