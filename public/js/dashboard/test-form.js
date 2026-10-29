// Test form: fields, test type, step preview, JSON Body and Headers sections, locking, status text,
// "Run again" settings and the draft kept across language changes.
// Limits (RPS, duration, steps, headers) come from the server (/api/limits): the single source is config.ts.

import { $ } from "../core/dom.js";
import { t, formatNumber } from "../core/i18n.js";
import { takeRerunSettings } from "../core/rerun.js";
import { withDefaultScheme } from "../core/url.js";
import { prettyJson } from "../core/json.js";
import { createCollapsible } from "../core/collapsible.js";
import { checkHeaders } from "../core/headers.js";
import { createHeaderEditor } from "./header-editor.js";

// The page reloads when the language changes: values typed into the form but not yet started are kept under this key
const DRAFT_STORAGE_KEY = "volta-form-draft";

// Limits from the server. Until they arrive (or if they can't), the form doesn't validate on its own:
// the server checks every request anyway, and the error message comes from there.
let limits = null;

// Size of the JSON Body for its summary line: "48 bytes", "1,2 KB"
function sizeText(bytes) {
    return bytes < 1024
        ? t("form.body.bytes", { value: formatNumber(bytes) })
        : t("form.body.kb", { value: formatNumber(bytes / 1024, 1) });
}

// RPS of the steps: same rounding as the scheduler on the server
function stepTargets(rps, steps) {
    return Array.from({ length: steps }, (_, i) => Math.max(1, Math.round((rps * (i + 1)) / steps)));
}

// Are the stepped test settings valid? Returns an error message if not.
function checkStepped(rps, duration, steps) {
    if (!limits) return null;
    if (!Number.isInteger(steps) || steps < limits.minStepCount || steps > limits.maxStepCount) {
        return t("form.stepCountRange", { min: limits.minStepCount, max: limits.maxStepCount });
    }
    // Each step must send at least 1 request per second
    if (rps < steps) {
        return t("form.stepRpsTooLow", { min: steps });
    }
    if (!(duration > 0) || duration / steps < limits.minStepDurationSeconds) {
        return t("form.stepTooShort", { min: limits.minStepDurationSeconds });
    }
    return null;
}

// Are RPS and duration valid? Applies to both test types. Returns an error message if not.
function checkBasics(rps, duration) {
    if (!limits) return null;
    if (!Number.isInteger(rps) || rps < limits.minTargetRps || rps > limits.maxTargetRps) {
        return t("form.rpsRange", { min: limits.minTargetRps, max: limits.maxTargetRps });
    }
    if (!Number.isInteger(duration) || duration < limits.minDurationSeconds || duration > limits.maxDurationSeconds) {
        return t("form.durationRange", { min: limits.minDurationSeconds, max: limits.maxDurationSeconds });
    }
    return null;
}

export function createTestForm() {
    const form = $("test-form");
    const urlInput = $("url");
    const methodSelect = $("method");
    const rpsInput = $("targetRps");
    const rpsLabel = $("rps-label");
    const durationInput = $("duration");
    const stepsBlock = $("steps-block");
    const stepCountInput = $("stepCount");
    const stepPreview = $("step-preview");
    const bodyInput = $("body");
    const bodyToggle = $("body-toggle");
    const bodySummary = $("body-summary");
    const headersSummary = $("headers-summary");
    const startBtn = $("start-btn");
    const stopBtn = $("stop-btn");
    const statusText = $("status-text");
    const liveBadge = $("live-badge");
    const profileButtons = document.querySelectorAll("[data-profile]");
    const bookBtn = $("target-book-btn");
    let profile = "CONSTANT";
    let locked = false;

    const bodySection = createCollapsible(bodyToggle, $("body-panel"));
    const headersSection = createCollapsible($("headers-toggle"), $("headers-panel"));

    // Summary lines shown on the right of the section titles (visible while the sections are closed)
    function updateSummaries() {
        if (methodSelect.value === "GET") {
            bodySummary.textContent = t("form.body.postOnly");
        } else {
            const bytes = new Blob([bodyInput.value.trim()]).size;
            bodySummary.textContent = bytes === 0 ? t("form.body.empty") : sizeText(bytes);
        }

        const headers = headerEditor.getHeaders();
        const hidden = headers.filter((h) => h.masked).length;
        const parts = [];
        if (headers.length === 0) parts.push(t("form.headers.none"));
        else parts.push(headers.length === 1 ? t("form.headers.countOne") : t("form.headers.count", { count: headers.length }));
        if (hidden > 0) parts.push(t("form.headers.hidden", { count: hidden }));
        headersSummary.textContent = parts.join(" · ");
    }

    const headerEditor = createHeaderEditor({
        container: $("header-rows"),
        addButton: $("header-add"),
        onChange: updateSummaries,
        onNotice: (text) => setStatus(text),
    });

    // GET sends no body: the JSON Body section is closed and locked (what's typed in it is kept for POST)
    function updateMethod() {
        const isGet = methodSelect.value === "GET";
        if (isGet) bodySection.close();
        bodyToggle.disabled = isGet;
        updateSummaries();
    }

    function updatePreview() {
        if (profile !== "STEPPED") return;

        // Don't show an error if the user hasn't typed anything yet (it's checked again on start)
        if (rpsInput.value === "" || durationInput.value === "") {
            stepPreview.textContent = "";
            return;
        }

        const rps = Number(rpsInput.value);
        const duration = Number(durationInput.value);
        const steps = Number(stepCountInput.value);
        // RPS and duration first, then the step rules
        const error = checkBasics(rps, duration) ?? checkStepped(rps, duration, steps);

        stepPreview.classList.toggle("text-signal-error", Boolean(error));
        stepPreview.classList.toggle("text-outline", !error);

        if (error) {
            stepPreview.textContent = error;
            return;
        }

        const seconds = duration / steps;
        stepPreview.textContent = t("form.stepPreview", {
            count: steps,
            steps: stepTargets(rps, steps).join(" → "),
            seconds: formatNumber(seconds, Number.isInteger(seconds) ? 0 : 1),
        });
    }

    // Apply the server's limits to the inputs: min/max (for the arrow keys) and a hint ("min 10")
    function applyLimits(newLimits) {
        limits = newLimits;

        rpsInput.min = limits.minTargetRps;
        rpsInput.max = limits.maxTargetRps;
        rpsInput.placeholder = t("form.rangePlaceholder", {
            min: formatNumber(limits.minTargetRps),
            max: formatNumber(limits.maxTargetRps),
        });

        durationInput.min = limits.minDurationSeconds;
        durationInput.max = limits.maxDurationSeconds;
        durationInput.placeholder = t("form.rangePlaceholder", {
            min: formatNumber(limits.minDurationSeconds),
            max: formatNumber(limits.maxDurationSeconds),
        });

        stepCountInput.min = limits.minStepCount;
        stepCountInput.max = limits.maxStepCount;

        updatePreview();
    }

    async function loadLimits() {
        try {
            const response = await fetch("/api/limits");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            applyLimits(await response.json());
        } catch (err) {
            // If the limits don't arrive the form doesn't validate; the server's error message is shown
            console.error("Could not fetch test limits:", err);
        }
    }

    function setProfile(newProfile) {
        profile = newProfile;

        profileButtons.forEach((btn) => {
            const active = btn.dataset.profile === profile;
            btn.classList.toggle("bg-surface-container-high", active);
            btn.classList.toggle("text-primary-container", active);
            btn.classList.toggle("text-on-surface-variant", !active);
            btn.setAttribute("aria-pressed", String(active));
        });

        stepsBlock.hidden = profile !== "STEPPED";
        rpsLabel.textContent = t(profile === "STEPPED" ? "form.rpsStepped" : "form.rps");
        updatePreview();
    }

    function setStatus(text, isError = false) {
        statusText.textContent = text;
        statusText.classList.toggle("text-signal-error", isError);
        statusText.classList.toggle("text-on-surface-variant", !isError);
    }

    // While a test runs the form is locked, and the "Stop" button and live indicator are visible
    function setLocked(isLocked) {
        locked = isLocked;
        for (const el of [urlInput, bookBtn, methodSelect, rpsInput, durationInput, stepCountInput, bodyInput, ...profileButtons]) {
            el.disabled = isLocked;
        }
        // The sections can still be opened during the test to see what's being sent, but not edited
        headerEditor.setDisabled(isLocked);
        startBtn.hidden = isLocked;
        stopBtn.hidden = !isLocked;
        liveBadge.hidden = !isLocked;
    }

    function setStartBusy(busy) {
        startBtn.disabled = busy;
    }

    function setStopBusy(busy) {
        stopBtn.disabled = busy;
    }

    // Converts the form values to the shape sent to the server. Returns { ok: false, error } if invalid.
    function readPayload() {
        const targetRps = Number(rpsInput.value);
        const duration = Number(durationInput.value);
        const stepCount = Number(stepCountInput.value);

        const basicError = checkBasics(targetRps, duration);
        if (basicError) return { ok: false, error: basicError };

        if (profile === "STEPPED") {
            const error = checkStepped(targetRps, duration, stepCount);
            if (error) return { ok: false, error };
        }

        // "localhost:5050/health" → "http://localhost:5050/health" (shown in the input too, so it's clear what's being tested)
        const url = withDefaultScheme(urlInput.value);
        urlInput.value = url;

        let body;
        if (methodSelect.value === "POST" && bodyInput.value.trim()) {
            try {
                body = JSON.parse(bodyInput.value);
            } catch {
                // Open the section so the problem is visible
                bodySection.open();
                return { ok: false, error: t("state.invalidJson") };
            }
        }

        const headers = headerEditor.getHeaders();
        const headerError = checkHeaders(headers);
        if (headerError) {
            headersSection.open();
            return { ok: false, error: headerError };
        }

        return {
            ok: true,
            payload: {
                url,
                method: methodSelect.value,
                body,
                headers,
                targetRps,
                duration,
                loadProfile: profile,
                ...(profile === "STEPPED" ? { stepCount } : {}),
            },
        };
    }

    // When reconnecting to a running test, fill the form with that test's settings
    // (in the server's test manager shape: durationSeconds, profile.type, profile.stepCount)
    function fillFromConfig(config) {
        const type = config.profile?.type ?? "CONSTANT";
        urlInput.value = config.url;
        methodSelect.value = config.method;
        rpsInput.value = config.targetRps;
        durationInput.value = config.durationSeconds;
        // Indented so the body is readable
        bodyInput.value = prettyJson(config.body ?? "");
        headerEditor.setHeaders(config.headers ?? []);
        if (type === "STEPPED") stepCountInput.value = config.profile.stepCount;
        setProfile(type);
        updateMethod();
    }

    // Fill the form with the given settings (shared by rerun and the draft)
    // (in the form's own shape: duration, loadProfile, stepCount). RPS and duration stay empty if not given.
    function fillForm(settings) {
        urlInput.value = settings.url ?? "";
        methodSelect.value = settings.method ?? "GET";
        rpsInput.value = settings.targetRps ?? "";
        durationInput.value = settings.duration ?? "";
        if (settings.stepCount) stepCountInput.value = settings.stepCount;
        bodyInput.value = settings.body ?? "";
        // Older saved settings have no headers
        headerEditor.setHeaders(settings.headers ?? []);
        setProfile(settings.loadProfile === "STEPPED" ? "STEPPED" : "CONSTANT");
        updateMethod();
    }

    // Fill the form if we came from "Run again" or a recommendation. Returns true if it was filled.
    function applyRerunSettings() {
        const settings = takeRerunSettings();
        if (!settings) return false;

        // The body is written indented so it's readable
        fillForm({ ...settings, body: prettyJson(settings.body ?? "") });
        setStatus(t("state.rerunLoaded"));
        return true;
    }

    // Before the language changes: save the form values (not needed if a test is running; it reconnects)
    function saveDraft() {
        if (locked) return;
        try {
            sessionStorage.setItem(
                DRAFT_STORAGE_KEY,
                JSON.stringify({
                    url: urlInput.value,
                    method: methodSelect.value,
                    targetRps: rpsInput.value,
                    duration: durationInput.value,
                    stepCount: stepCountInput.value,
                    body: bodyInput.value,
                    headers: headerEditor.getHeaders(),
                    loadProfile: profile,
                })
            );
        } catch {
            // If it can't be saved the form opens empty; that's fine
        }
    }

    // Restore the draft after reload (once). Returns true if it was restored.
    function restoreDraft() {
        try {
            const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
            if (!raw) return false;
            sessionStorage.removeItem(DRAFT_STORAGE_KEY);
            fillForm(JSON.parse(raw));
            return true;
        } catch {
            return false;
        }
    }

    function onSubmit(handler) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            handler();
        });
    }

    function onStop(handler) {
        stopBtn.addEventListener("click", handler);
    }

    // --- Events ---
    profileButtons.forEach((btn) => btn.addEventListener("click", () => setProfile(btn.dataset.profile)));
    for (const input of [rpsInput, durationInput, stepCountInput]) {
        input.addEventListener("input", updatePreview);
    }
    methodSelect.addEventListener("change", updateMethod);
    bodyInput.addEventListener("input", updateSummaries);

    setProfile("CONSTANT");
    updateMethod();
    loadLimits();

    // For the target book: read / write the URL in the form
    function getUrl() {
        return urlInput.value;
    }

    function setUrl(url) {
        urlInput.value = url;
        urlInput.focus();
    }

    return {
        getUrl,
        setUrl,
        setStatus,
        setLocked,
        setStartBusy,
        setStopBusy,
        readPayload,
        fillFromConfig,
        applyRerunSettings,
        saveDraft,
        restoreDraft,
        onSubmit,
        onStop,
    };
}