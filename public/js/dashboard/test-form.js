// Test formu: alanlar, test türü, kademe önizlemesi, kilitleme, durum yazısı,
// "Yeniden Çalıştır" ayarları ve dil değişiminde korunan taslak.
// Sınırlar (RPS, süre, kademe) sunucudan gelir (/api/limits): tek kaynak config.ts.

import { $ } from "../core/dom.js";
import { t, formatNumber } from "../core/i18n.js";
import { takeRerunSettings } from "../core/rerun.js";
import { withDefaultScheme } from "../core/url.js";

// Dil değişince sayfa yenilenir: formdaki yazılmış ama başlatılmamış değerler bu anahtarla korunur
const DRAFT_STORAGE_KEY = "volta-form-draft";

// Sunucudan gelen sınırlar. Gelene kadar (ya da gelemezse) form kendi kontrolünü yapmaz:
// sunucu her isteği zaten kontrol ediyor, hata mesajı oradan gelir.
let limits = null;

// Kademelerin RPS'i: sunucudaki zamanlayıcıyla aynı yuvarlama
function stepTargets(rps, steps) {
    return Array.from({ length: steps }, (_, i) => Math.max(1, Math.round((rps * (i + 1)) / steps)));
}

// Kademeli test ayarları geçerli mi? Geçersizse hata mesajı döner.
function checkStepped(rps, duration, steps) {
    if (!limits) return null;
    if (!Number.isInteger(steps) || steps < limits.minStepCount || steps > limits.maxStepCount) {
        return t("form.stepCountRange", { min: limits.minStepCount, max: limits.maxStepCount });
    }
    // Her kademe saniyede en az 1 istek göndermeli
    if (rps < steps) {
        return t("form.stepRpsTooLow", { min: steps });
    }
    if (!(duration > 0) || duration / steps < limits.minStepDurationSeconds) {
        return t("form.stepTooShort", { min: limits.minStepDurationSeconds });
    }
    return null;
}

// RPS ve süre geçerli mi? Her iki test türü için de geçerli. Geçersizse hata mesajı döner.
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
    const startBtn = $("start-btn");
    const stopBtn = $("stop-btn");
    const statusText = $("status-text");
    const liveBadge = $("live-badge");
    const profileButtons = document.querySelectorAll("[data-profile]");
    const bookBtn = $("target-book-btn");
    let profile = "CONSTANT";
    let locked = false;

    function updatePreview() {
        if (profile !== "STEPPED") return;

        // Kullanıcı daha bir şey yazmadıysa hata gösterme (başlatırken yine kontrol edilir)
        if (rpsInput.value === "" || durationInput.value === "") {
            stepPreview.textContent = "";
            return;
        }

        const rps = Number(rpsInput.value);
        const duration = Number(durationInput.value);
        const steps = Number(stepCountInput.value);
        // Önce RPS ve süre, sonra kademe kuralları
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

    // Sunucudan gelen sınırları kutulara uygula: min/max (klavye okları için) ve ipucu ("min 10")
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
            // Sınırlar gelmezse form kontrol yapmaz, sunucunun hata mesajı gösterilir
            console.error("Test sınırları alınamadı:", err);
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

    // Test sürerken form kilitli, "Durdur" butonu ve canlı işareti görünür
    function setLocked(isLocked) {
        locked = isLocked;
        for (const el of [urlInput, bookBtn, methodSelect, rpsInput, durationInput, stepCountInput, bodyInput, ...profileButtons]) {
            el.disabled = isLocked;
        }
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

    // Formdaki değerleri sunucuya gidecek biçime çevirir. Geçersizse { ok: false, error } döner.
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

        // "localhost:5050/health" → "http://localhost:5050/health" (kutuda da görünsün, neyin test edildiği belli olsun)
        const url = withDefaultScheme(urlInput.value);
        urlInput.value = url;

        let body;
        if (methodSelect.value === "POST" && bodyInput.value.trim()) {
            try {
                body = JSON.parse(bodyInput.value);
            } catch {
                return { ok: false, error: t("state.invalidJson") };
            }
        }

        return {
            ok: true,
            payload: {
                url,
                method: methodSelect.value,
                body,
                targetRps,
                duration,
                loadProfile: profile,
                ...(profile === "STEPPED" ? { stepCount } : {}),
            },
        };
    }

    // Çalışan bir teste yeniden bağlanırken formu o testin ayarlarıyla doldur
    // (sunucudaki test yöneticisinin biçimi: durationSeconds, profile.type, profile.stepCount)
    function fillFromConfig(config) {
        const type = config.profile?.type ?? "CONSTANT";
        urlInput.value = config.url;
        methodSelect.value = config.method;
        rpsInput.value = config.targetRps;
        durationInput.value = config.durationSeconds;
        // Gövde okunaklı olsun diye girintili (geçerli JSON değilse olduğu gibi)
        let body = config.body ?? "";
        try {
            if (body) body = JSON.stringify(JSON.parse(body), null, 2);
        } catch {
            // olduğu gibi
        }
        bodyInput.value = body;
        if (type === "STEPPED") stepCountInput.value = config.profile.stepCount;
        setProfile(type);
    }

    // Formu verilen ayarlarla doldur (yeniden çalıştırma ve taslak ortak kullanır)
    // (formun kendi biçimi: duration, loadProfile, stepCount). Verilmeyen RPS ve süre boş kalır.
    function fillForm(settings) {
        urlInput.value = settings.url ?? "";
        methodSelect.value = settings.method ?? "GET";
        rpsInput.value = settings.targetRps ?? "";
        durationInput.value = settings.duration ?? "";
        if (settings.stepCount) stepCountInput.value = settings.stepCount;
        bodyInput.value = settings.body ?? "";
        setProfile(settings.loadProfile === "STEPPED" ? "STEPPED" : "CONSTANT");
    }

    // "Yeniden Çalıştır" ya da öneriden gelindiyse formu doldur. Dolduysa true döner.
    function applyRerunSettings() {
        const settings = takeRerunSettings();
        if (!settings) return false;

        // Body okunaklı olsun diye girintili yazılır
        let body = settings.body ?? "";
        try {
            if (body) body = JSON.stringify(JSON.parse(body), null, 2);
        } catch {
            // Geçerli JSON değilse olduğu gibi
        }

        fillForm({ ...settings, body });
        setStatus(t("state.rerunLoaded"));
        return true;
    }

    // Dil değişmeden önce: formdaki değerleri kaydet (test çalışıyorsa gerek yok, yeniden bağlanılır)
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
                    loadProfile: profile,
                })
            );
        } catch {
            // Kaydedilemezse form boş açılır, sorun değil
        }
    }

    // Yenilenince taslağı geri yükle (bir kez). Yüklendiyse true döner.
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

    // --- Olaylar ---
    profileButtons.forEach((btn) => btn.addEventListener("click", () => setProfile(btn.dataset.profile)));
    for (const input of [rpsInput, durationInput, stepCountInput]) {
        input.addEventListener("input", updatePreview);
    }

    setProfile("CONSTANT");
    loadLimits();

    // Rehber için: formdaki URL'yi oku / yaz
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