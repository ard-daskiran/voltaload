// Status code card: ratio bar, one row per code, and an info box that opens on hover.
// Rows aren't deleted and recreated, only their counts are updated (so the info box doesn't flicker).

import { t, formatNumber } from "../core/i18n.js";
import { statusCategory, statusDescription, statusName, statusStyle, sortStatusCodes } from "./status-info.js";

// Row for a code: dot, code, short name, count, percentage and info box
function createStatusRow(code) {
    const style = statusStyle(code);

    const row = document.createElement("div");
    row.className = "group relative flex items-center gap-3 font-data-md text-[13px] cursor-default";
    row.dataset.code = String(code);

    const dot = document.createElement("span");
    dot.className = `w-2 h-2 rounded-full ${style.dot} shrink-0`;

    const codeEl = document.createElement("span");
    codeEl.className = "text-on-surface min-w-[150px]";
    codeEl.textContent = String(code);

    const nameEl = document.createElement("span");
    nameEl.className = "text-on-surface-variant flex-1 truncate";
    nameEl.textContent = statusName(code);

    const countEl = document.createElement("span");
    countEl.className = `${style.text} w-20 text-right`;
    countEl.dataset.role = "count";

    const percentEl = document.createElement("span");
    percentEl.className = "text-outline w-16 text-right";
    percentEl.dataset.role = "percent";

    // Info box: name (in its own color), description, category label
    const tooltip = document.createElement("div");
    tooltip.className =
        "pointer-events-none absolute top-full left-5 mt-1 w-[300px] z-30 " +
        "bg-surface-container-lowest border border-border-subtle px-3 py-2.5 shadow-lg " +
        "opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col gap-1.5";

    const title = document.createElement("span");
    title.className = `${style.text} font-semibold text-[12px]`;
    title.textContent = statusName(code) ? `${code} · ${statusName(code)}` : String(code);

    const description = document.createElement("span");
    description.className = "font-body-md text-[12px] leading-snug text-on-surface";
    description.textContent = statusDescription(code);

    const tag = document.createElement("span");
    tag.className = `self-start text-[11px] px-2 py-0.5 border border-border-subtle ${style.text}`;
    tag.textContent = t(`status.tag.${statusCategory(code)}`);

    tooltip.append(title, description, tag);
    row.append(dot, codeEl, nameEl, countEl, percentEl, tooltip);
    return row;
}

function updateStatusRow(row, count, total) {
    row.querySelector('[data-role="count"]').textContent = formatNumber(count);
    const percent = total > 0 ? (count / total) * 100 : 0;
    row.querySelector('[data-role="percent"]').textContent = t("statusCard.percent", { value: formatNumber(percent, 1) });
}

// Builds the card. Takes the card's inner elements as parameters, returns reset() and update().
export function createStatusCard({ rowsEl, barEl, emptyEl, totalEl }) {
    function reset() {
        rowsEl.innerHTML = "";
        barEl.innerHTML = "";
        emptyEl.hidden = false;
        totalEl.textContent = t("statusCard.total", { count: 0 });
    }

    // statusCounts: { "200": 812, "503": 2001, "TIMEOUT": 40 }
    function update(statusCounts, total) {
        const codes = sortStatusCodes(Object.keys(statusCounts));
        const existing = new Map();
        for (const el of rowsEl.querySelectorAll("[data-code]")) {
            existing.set(el.dataset.code, el);
        }

        let added = false;

        for (const code of codes) {
            let row = existing.get(code);
            if (!row) {
                row = createStatusRow(code);
                rowsEl.appendChild(row);
                added = true;
            }
            updateStatusRow(row, statusCounts[code], total);
        }

        // If a new code was added, fix the order (appendChild doesn't delete an existing row, it just moves it)
        if (added) {
            for (const code of codes) {
                rowsEl.appendChild(rowsEl.querySelector(`[data-code="${code}"]`));
            }
        }

        // Ratio bar
        barEl.innerHTML = "";
        if (total > 0) {
            for (const code of codes) {
                const segment = document.createElement("div");
                segment.className = `${statusStyle(code).bar} h-full`;
                segment.style.width = `${(statusCounts[code] / total) * 100}%`;
                barEl.appendChild(segment);
            }
        }

        emptyEl.hidden = codes.length > 0;
        totalEl.textContent = t("statusCard.total", { count: formatNumber(total) });
    }

    reset();
    return { reset, update };
}