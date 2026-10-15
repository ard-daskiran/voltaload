// Sort dropdown menu. Options stay in a fixed order; the selected one is yellow and marked with ✓.
// Closes when clicking outside the menu or pressing Esc.

import { $ } from "../core/dom.js";
import { t } from "../core/i18n.js";

// To add a new option, adding a line here is enough (the server must recognize that value too)
const OPTIONS = [
    { value: "newest", label: "history.sort.optionNewest" },
    { value: "oldest", label: "history.sort.optionOldest" },
];

// onChange(value): when the user picks a different option
export function createSortMenu({ onChange }) {
    const root = $("history-sort");
    const toggle = $("history-sort-toggle");
    const label = $("history-sort-label");
    const arrow = $("history-sort-arrow");
    const menu = $("history-sort-menu");

    let current = OPTIONS[0].value;

    function optionLabel(value) {
        const option = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];
        return t(option.label);
    }

    function renderOptions() {
        const items = OPTIONS.map((option) => {
            const selected = option.value === current;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.setAttribute("role", "option");
            btn.setAttribute("aria-selected", String(selected));
            btn.className =
                "flex items-center gap-2 px-3 py-1.5 font-label-caps text-[11px] text-left whitespace-nowrap transition-colors " +
                (selected ? "text-primary-container" : "text-on-surface-variant hover:bg-surface-variant hover:text-on-surface");

            // The check mark only shows on the selected one, but its space is always reserved (so the text stays aligned)
            const check = document.createElement("span");
            check.className = `material-symbols-outlined text-[14px] ${selected ? "" : "invisible"}`;
            check.textContent = "check";

            const text = document.createElement("span");
            text.textContent = t(option.label);

            btn.append(check, text);
            btn.addEventListener("click", () => {
                close();
                if (option.value !== current) onChange(option.value);
            });
            return btn;
        });

        menu.replaceChildren(...items);
    }

    function open() {
        menu.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        arrow.classList.add("rotate-180");
    }

    function close() {
        menu.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        arrow.classList.remove("rotate-180");
    }

    // Set the selected value from outside (read from the page URL or newly chosen)
    function setValue(value) {
        current = value;
        label.textContent = t("history.sort.label", { value: optionLabel(value) });
        renderOptions();
    }

    toggle.addEventListener("click", () => (menu.hidden ? open() : close()));

    document.addEventListener("click", (e) => {
        if (!root.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
    });

    setValue(current);
    return { setValue };
}