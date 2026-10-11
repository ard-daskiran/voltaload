// Sıralama açılır menüsü. Seçenekler sabit sırada durur, seçili olan sarı ve ✓ ile işaretlenir.
// Menünün dışına tıklayınca ya da Esc'ye basınca kapanır.

import { $ } from "../core/dom.js";
import { t } from "../core/i18n.js";

// Yeni seçenek eklemek için buraya bir satır eklemek yeterli (sunucu da o değeri tanımalı)
const OPTIONS = [
    { value: "newest", label: "history.sort.optionNewest" },
    { value: "oldest", label: "history.sort.optionOldest" },
];

// onChange(value): kullanıcı farklı bir seçenek seçince
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

            // Tik işareti sadece seçili olanda görünür, ama yer hep ayrılır (yazılar hizalı kalsın)
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

    // Dışarıdan seçili değeri ayarla (sayfa adresinden okunan ya da yeni seçilen)
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