// When opening a test from the list, notes the list's state (page, filter, search).
// "← History" on the detail page uses this note to return where you left off, and the test you clicked is highlighted.
// sessionStorage: per tab, deleted when the tab closes.

const STORAGE_KEY = "volta-history-return";
const FALLBACK_URL = "/history.html";

// Called by the list page, right before going to a test
export function rememberListPosition(testRunId) {
    sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ url: window.location.pathname + window.location.search, testRunId })
    );
}

// Called by the detail page: if the note is for this test, return to that list state, otherwise to the plain list.
// "focus" is added to the return URL; the list scrolls to that row and highlights it.
export function getReturnUrl(testRunId) {
    try {
        const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
        if (saved && saved.testRunId === testRunId && typeof saved.url === "string" && saved.url.startsWith(FALLBACK_URL)) {
            const separator = saved.url.includes("?") ? "&" : "?";
            return `${saved.url}${separator}focus=${encodeURIComponent(testRunId)}`;
        }
    } catch {
        // If the note is corrupt, return to the plain list
    }
    return FALLBACK_URL;
}