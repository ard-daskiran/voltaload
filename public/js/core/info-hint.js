// Info box: puts a faint "?" icon next to a label; hovering opens an explanation.
// Texts come from the dictionary: hint.<key>.text (explanation), hint.<key>.graph (its counterpart on the chart, optional)
// The title is shown in the color of the card or value it belongs to.

import { t } from "./i18n.js";

const DEFAULT_TITLE_COLOR = "#e1e2eb";

// container: element that opens the box on hover (card or row)
// labelEl: label to put the "?" icon next to
// titleColor: the box's title color (the card's or value's color)
// position: "below" (opens below) or "above" (opens above)
// align: "left" or "right" (for elements at the right edge of the screen)
export function attachHint({ container, labelEl, hintKey, titleColor = DEFAULT_TITLE_COLOR, position = "below", align = "left" }) {
    // overflow-hidden is removed so the box can extend outside the card
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

    // Its counterpart on the chart, if any, on a separate line
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

// Add info boxes to elements marked in HTML:
//   <div data-hint="avg" data-hint-color="#f4c21a" [data-hint-align="right"] [data-hint-position="above"]>
//     <span data-hint-label>ORTALAMA</span> ...
// Must be called AFTER applyTranslations (the title is taken from the label's translated text).
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