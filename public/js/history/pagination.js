// Pagination: "Showing 21 - 40 of 87 test runs" and the page buttons.

import { t, formatNumber } from "../core/i18n.js";

// Page numbers to show. With many pages, "…" goes in between: 1 … 4 5 6 … 12
function pageWindow(current, totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);

    if (start > 2) pages.push("…");
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push("…");
    pages.push(totalPages);

    return pages;
}

function button(content, { active = false, disabled = false, onClick } = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.disabled = disabled;
    btn.className = active
        ? "px-3 py-1 rounded bg-primary-container text-on-primary-container font-data-md text-sm font-bold"
        : "px-2.5 py-1 rounded border border-border-subtle text-on-surface-variant hover:bg-surface-variant hover:text-on-surface font-data-md text-sm transition-colors disabled:opacity-40 disabled:hover:bg-transparent";

    if (typeof content === "string" && content.startsWith("icon:")) {
        const icon = document.createElement("span");
        icon.className = "material-symbols-outlined text-[16px] block";
        icon.textContent = content.slice(5);
        btn.append(icon);
    } else {
        btn.textContent = String(content);
    }

    if (onClick) btn.addEventListener("click", onClick);
    return btn;
}

// onChange(page): when a page button is clicked
export function createPagination({ rangeEl, pagesEl, onChange }) {
    function render({ page, pageSize, total }) {
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        if (total === 0) {
            rangeEl.textContent = t("history.rangeEmpty");
        } else {
            const from = (page - 1) * pageSize + 1;
            const to = Math.min(page * pageSize, total);
            rangeEl.textContent = t("history.range", {
                total: formatNumber(total),
                from: formatNumber(from),
                to: formatNumber(to),
            });
        }

        const buttons = [button("icon:chevron_left", { disabled: page <= 1, onClick: () => onChange(page - 1) })];

        for (const p of pageWindow(page, totalPages)) {
            if (p === "…") {
                const gap = document.createElement("span");
                gap.className = "px-1 text-on-surface-variant";
                gap.textContent = "…";
                buttons.push(gap);
            } else {
                buttons.push(button(p, { active: p === page, onClick: p === page ? undefined : () => onChange(p) }));
            }
        }

        buttons.push(button("icon:chevron_right", { disabled: page >= totalPages, onClick: () => onChange(page + 1) }));
        pagesEl.replaceChildren(...buttons);
    }

    return { render };
}