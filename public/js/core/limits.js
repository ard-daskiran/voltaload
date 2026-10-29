// limits.js
// Volta's settings that the UI needs (from config.ts via /api/limits), loaded once before any page code runs.
// Every module that imports this waits for it (top-level await); locally it takes a few milliseconds.
// If the settings can't be loaded, the defaults below are used so the page still works.

const DEFAULTS = { requestTimeoutMs: 2500, maxBodyKb: 100, maxHeaders: 20, maxHeaderBytes: 8192 };

async function loadLimits() {
    try {
        const response = await fetch("/api/limits");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { ...DEFAULTS, ...(await response.json()) };
    } catch (err) {
        console.error("Could not load Volta's settings, using defaults:", err);
        return { ...DEFAULTS };
    }
}

export const LIMITS = await loadLimits();