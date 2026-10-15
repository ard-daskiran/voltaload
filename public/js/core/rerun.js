// For "Run again" and "Run this test" in the recommendations:
// the settings are left by one page; the form on the home page reads them once and deletes them.

const RERUN_STORAGE_KEY = "volta-rerun";

// Leave the settings, go to the home page (the form fills with these settings)
// settings: { url, method, body, targetRps, duration, loadProfile, stepCount }
export function rerunWith(settings) {
    sessionStorage.setItem(RERUN_STORAGE_KEY, JSON.stringify(settings));
    window.location.href = "/";
}

// Take the left settings and delete them (used once, so the form doesn't refill on page reload).
// Returns null if there are no settings or they can't be read.
export function takeRerunSettings() {
    const raw = sessionStorage.getItem(RERUN_STORAGE_KEY);
    if (!raw) return null;

    sessionStorage.removeItem(RERUN_STORAGE_KEY);

    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error("Could not read the rerun settings:", err);
        return null;
    }
}