// Detay sayfasının sol sütunu: testin ayarları (salt okunur) ve "Yeniden Çalıştır".

import { $ } from "../core/dom.js";
import { t, formatNumber, getLocale } from "../core/i18n.js";
import { runStatusStyle, runStatusLabel } from "../status/run-status.js";
import { rerunWith } from "../core/rerun.js";
import { prettyJson } from "../core/json.js";

function renderStatus(el, status) {
    const style = runStatusStyle(status);

    const dot = document.createElement("span");
    dot.className = `w-2 h-2 rounded-full ${style.dot}`;

    const label = document.createElement("span");
    label.className = style.text;
    label.textContent = runStatusLabel(status);

    el.replaceChildren(dot, label);
}

export function createTestSettings() {
    let current = null;

    function show(testRun) {
        current = testRun;
        const stepped = testRun.loadProfile === "STEPPED";

        // Rehberde kayıtlıysa isim üstte, URL altında küçük ve soluk
        const name = testRun.targetName;
        $("d-target-name").hidden = !name;
        $("d-target-name").textContent = name ?? "";
        $("d-url").textContent = testRun.url;
        $("d-url").className = name
            ? "font-data-md text-[12px] text-on-surface-variant/70 break-all"
            : "font-data-md text-data-md text-on-surface break-all";
        $("d-method").textContent = testRun.method;
        $("d-profile").textContent = stepped
            ? `${t("form.profile.stepped")} · ${t("detail.steps", { count: testRun.stepCount })}`
            : t("form.profile.constant");

        // Kademeli testte hedef, son kademenin RPS'i
        $("d-target-rps-label").textContent = t(stepped ? "form.rpsStepped" : "detail.targetRps");
        $("d-target-rps").textContent = formatNumber(testRun.targetRps);
        $("d-duration").textContent = t("detail.seconds", { value: testRun.duration });
        $("d-date").textContent = new Date(testRun.createdAt).toLocaleString(getLocale());
        renderStatus($("d-status"), testRun.status);

        const hasBody = Boolean(testRun.body);
        $("d-body-block").hidden = !hasBody;
        if (hasBody) $("d-body").textContent = prettyJson(testRun.body);
    }

    // Ayarları anasayfaya bırak ve oraya git (form bu ayarlarla dolar)
    function rerun() {
        if (!current) return;

        rerunWith({
            url: current.url,
            method: current.method,
            body: current.body,
            targetRps: current.targetRps,
            duration: current.duration,
            loadProfile: current.loadProfile,
            stepCount: current.stepCount,
        });
    }

    $("rerun-btn").addEventListener("click", rerun);

    return { show };
}