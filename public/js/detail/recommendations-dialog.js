// Öneriler penceresi. Kapasiteyle ilgili önerilerde "Bu testi çalıştır" butonu,
// anasayfaya gidip formu önerilen ayarlarla (URL, yöntem ve body bu testinki) doldurur.

import { t } from "../core/i18n.js";
import { rerunWith } from "../core/rerun.js";
import { recommendationView, followUpText, TONE_COLORS } from "../analysis/analysis-text.js";

function el(tag, className = "", text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function recommendationCard(rec, testRun) {
    const view = recommendationView(rec);
    const color = TONE_COLORS[view.tone];

    const card = el("div", "flex gap-3 px-5 py-4 border-b border-border-subtle last:border-b-0");

    const icon = el("span", "material-symbols-outlined text-[20px] shrink-0 mt-0.5", view.icon);
    icon.style.color = color;

    const body = el("div", "flex-1 min-w-0 flex flex-col gap-1.5");
    body.append(
        el("span", "font-data-md text-data-md text-on-surface font-semibold", view.title),
        el("p", "font-body-md text-[13px] leading-snug text-on-surface-variant", view.text)
    );

    // Önerilen takip testi
    if (view.test) {
        const row = el("div", "flex flex-wrap items-center justify-between gap-3 mt-1");
        const settings = el("span", "font-data-md text-[12px] text-on-surface border border-border-subtle bg-surface-container-low rounded px-2 py-1", followUpText(view.test));

        const run = el(
            "button",
            "flex items-center gap-1.5 px-3 py-1.5 border border-secondary text-secondary font-label-caps text-[11px] rounded hover:bg-secondary/10 transition-colors"
        );
        run.type = "button";
        run.append(el("span", "", t("rec.runTest")), el("span", "material-symbols-outlined text-[16px]", "arrow_forward"));
        run.addEventListener("click", () =>
            rerunWith({
                url: testRun.url,
                method: testRun.method,
                body: testRun.body,
                targetRps: view.test.targetRps,
                duration: view.test.duration,
                loadProfile: view.test.loadProfile,
                stepCount: view.test.stepCount,
            })
        );

        row.append(settings, run);
        body.append(row);
    }

    card.append(icon, body);
    return card;
}

export function openRecommendations(recommendations, testRun) {
    const overlay = el("div", "fixed inset-0 z-[60] flex items-start justify-center p-4 pt-24 bg-background/80 backdrop-blur-sm");
    const box = el(
        "div",
        "relative w-full max-w-xl bg-surface-container-lowest border border-border-subtle rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[calc(100vh-8rem)]"
    );
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");

    // Başlık
    const header = el("div", "flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-container-low/70");
    const title = el("div", "flex items-center gap-2");
    const titleIcon = el("span", "material-symbols-outlined text-[20px] text-secondary", "tips_and_updates");
    title.append(titleIcon, el("h2", "font-headline-md text-headline-md text-on-surface", t("rec.dialogTitle")));

    const closeBtn = el("button", "p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-colors");
    closeBtn.type = "button";
    closeBtn.title = t("dialog.close");
    closeBtn.append(el("span", "material-symbols-outlined text-[20px] block", "close"));
    header.append(title, closeBtn);

    // Liste
    const list = el("div", "overflow-y-auto");
    recommendations.forEach((rec) => list.append(recommendationCard(rec, testRun)));

    box.append(header, list);
    overlay.append(box);

    // Kapanma: ✕, Esc, dışarıda basılıp dışarıda bırakılan tıklama
    function close() {
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        document.body.style.overflow = "";
    }

    function onKey(e) {
        if (e.key === "Escape") close();
    }

    let pressedOnBackdrop = false;
    overlay.addEventListener("mousedown", (e) => {
        pressedOnBackdrop = e.target === overlay;
    });
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay && pressedOnBackdrop) close();
    });
    closeBtn.addEventListener("click", close);

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    document.body.append(overlay);
    closeBtn.focus();
}