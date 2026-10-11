// Bilgi kutusu: bir etiketin yanına soluk "?" simgesi koyar, üzerine gelince açıklama açılır.
// Metinler sözlükten gelir: hint.<anahtar>.text (açıklama), hint.<anahtar>.graph (grafikte karşılığı, isteğe bağlı)
// Başlık, ait olduğu kartın ya da değerin renginde gösterilir.

import { t } from "./i18n.js";

const DEFAULT_TITLE_COLOR = "#e1e2eb";

// container: üzerine gelinince kutunun açılacağı öğe (kart ya da satır)
// labelEl: yanına "?" simgesi konacak etiket
// titleColor: kutunun başlık rengi (kartın ya da değerin rengi)
// position: "below" (altında açılır) ya da "above" (üstünde açılır)
// align: "left" ya da "right" (ekranın sağ kenarındaki öğeler için)
export function attachHint({ container, labelEl, hintKey, titleColor = DEFAULT_TITLE_COLOR, position = "below", align = "left" }) {
    // Kutu kart dışına taşabilsin diye overflow-hidden kaldırılır
    container.classList.add("group", "relative");
    container.classList.remove("overflow-hidden");

    const icon = document.createElement("span");
    icon.className =
        "material-symbols-outlined text-[14px] text-outline/60 group-hover:text-on-surface-variant transition-colors ml-1 align-middle cursor-help normal-case";
    icon.textContent = "help";
    labelEl.append(icon);

    const box = document.createElement("div");
    box.className =
        "pointer-events-none absolute w-[300px] max-w-[80vw] z-30 bg-surface-container-lowest border border-border-subtle px-3 py-2.5 shadow-lg " +
        "opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col gap-1.5 normal-case tracking-normal text-left " +
        (position === "above" ? "bottom-full mb-1 " : "top-full mt-1 ") +
        (align === "right" ? "right-0" : "left-0");

    const title = document.createElement("span");
    title.className = "font-data-md text-[12px] font-semibold";
    title.style.color = titleColor;
    title.textContent = labelEl.textContent.replace("help", "").trim();

    const text = document.createElement("span");
    text.className = "font-body-md text-[12px] leading-snug text-on-surface";
    text.textContent = t(`hint.${hintKey}.text`);

    box.append(title, text);

    // Grafikte karşılığı varsa ayrı satırda
    const graphKey = `hint.${hintKey}.graph`;
    const graph = t(graphKey);
    if (graph !== graphKey) {
        const graphEl = document.createElement("span");
        graphEl.className = "font-data-md text-[11px] text-outline border-t border-border-subtle pt-1.5";
        graphEl.textContent = t("hint.graphPrefix", { text: graph });
        box.append(graphEl);
    }

    container.append(box);
}

// HTML'de işaretlenmiş öğelere bilgi kutusu ekle:
//   <div data-hint="avg" data-hint-color="#f4c21a" [data-hint-align="right"] [data-hint-position="above"]>
//     <span data-hint-label>ORTALAMA</span> ...
// applyTranslations'tan SONRA çağrılmalı (başlık, etiketin çevrilmiş metninden alınır).
export function attachHintsFromMarkup(root = document) {
    root.querySelectorAll("[data-hint]").forEach((container) => {
        attachHint({
            container,
            labelEl: container.querySelector("[data-hint-label]") ?? container,
            hintKey: container.dataset.hint,
            titleColor: container.dataset.hintColor ?? DEFAULT_TITLE_COLOR,
            position: container.dataset.hintPosition ?? "below",
            align: container.dataset.hintAlign ?? "left",
        });
    });
}