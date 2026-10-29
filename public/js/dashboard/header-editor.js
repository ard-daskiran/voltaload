// header-editor.js
// The form's header rows: name, value, lock (hide the value on the detail page and in the report) and remove.
//   - A name like Authorization or X-Api-Key locks the row by itself, until the user sets the lock themselves
//   - Unlocking asks for confirmation (the value will appear in plain text in the report); locking doesn't
//   - Several "Name: value" lines pasted into a name field are split into rows
// Empty rows are ignored when the test starts.

import { t } from "../core/i18n.js";
import { el } from "../core/dom.js";
import { LIMITS } from "../core/limits.js";
import { confirmDialog } from "../core/confirm-dialog.js";
import { isSensitiveHeader, parseHeaderLines, FORBIDDEN_HEADERS } from "../core/headers.js";

const INPUT_CLASS =
    "min-w-0 bg-surface-container-lowest border border-border-subtle py-1.5 px-2 font-data-md text-[13px] focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all disabled:opacity-60";
const ICON_BUTTON_CLASS =
    "shrink-0 p-1 rounded text-on-surface-variant hover:bg-surface-variant transition-colors disabled:opacity-40 disabled:hover:bg-transparent";

// onChange: the rows changed (for the summary line). onNotice(text): a message for the form's status line.
export function createHeaderEditor({ container, addButton, onChange, onNotice }) {
    const rows = [];
    let disabled = false;

    function renderLock(row) {
        row.lockIcon.textContent = row.masked ? "lock" : "lock_open";
        row.lockBtn.title = t(row.masked ? "form.headers.unlock" : "form.headers.lock");
        row.lockBtn.setAttribute("aria-pressed", String(row.masked));
        row.lockBtn.classList.toggle("text-primary-container", row.masked);
    }

    function updateAddButton() {
        addButton.disabled = disabled || rows.length >= LIMITS.maxHeaders;
    }

    function setRowDisabled(row) {
        for (const control of [row.nameInput, row.valueInput, row.lockBtn, row.removeBtn]) {
            control.disabled = disabled;
        }
    }

    async function toggleLock(row) {
        if (row.masked) {
            const name = row.nameInput.value.trim() || t("form.headers.thisHeader");
            const confirmed = await confirmDialog({
                title: t("form.headers.unlockTitle"),
                message: t("form.headers.unlockMessage", { name }),
                confirmLabel: t("form.headers.unlockConfirm"),
            });
            if (!confirmed) return;
        }
        row.masked = !row.masked;
        row.userSetLock = true;
        renderLock(row);
        onChange();
    }

    // Fill a row from a pasted or saved header. The lock follows the name unless the user has set it.
    function fillRow(row, { name, value }) {
        row.nameInput.value = name;
        row.valueInput.value = value;
        if (!row.userSetLock) {
            row.masked = isSensitiveHeader(name);
            renderLock(row);
        }
    }

    function removeRow(row) {
        row.root.remove();
        rows.splice(rows.indexOf(row), 1);
        updateAddButton();
        onChange();
    }

    function handlePaste(event, row) {
        const text = event.clipboardData?.getData("text") ?? "";
        // A plain name: normal paste
        if (!text.includes(":") && !text.includes("\n")) return;
        event.preventDefault();

        const parsed = parseHeaderLines(text);
        const skipped = parsed.filter((h) => FORBIDDEN_HEADERS.has(h.name.toLowerCase())).map((h) => h.name);
        const usable = parsed.filter((h) => !FORBIDDEN_HEADERS.has(h.name.toLowerCase()));

        let limitReached = false;
        usable.forEach((header, index) => {
            if (index === 0) {
                fillRow(row, header);
                return;
            }
            const added = addRow();
            if (added) fillRow(added, header);
            else limitReached = true;
        });

        // Headers copied from the browser often include Host, Connection and the like: they're left out, with a note
        const notices = [];
        if (skipped.length > 0) notices.push(t("form.headers.skipped", { names: skipped.join(", ") }));
        if (limitReached) notices.push(t("form.headers.limitReached", { max: LIMITS.maxHeaders }));
        if (notices.length > 0) onNotice(notices.join(" "));

        onChange();
    }

    // masked: undefined → decided by the name (and keeps following it); true/false → as given (a saved test)
    function addRow({ name = "", value = "", masked } = {}) {
        if (rows.length >= LIMITS.maxHeaders) return null;

        const root = el("div", "flex items-center gap-1.5");

        const nameInput = el("input", `${INPUT_CLASS} w-[42%] text-secondary`);
        const valueInput = el("input", `${INPUT_CLASS} flex-1 text-on-surface`);
        for (const input of [nameInput, valueInput]) {
            input.type = "text";
            input.autocomplete = "off";
            input.spellcheck = false;
        }
        nameInput.placeholder = t("form.headers.namePlaceholder");
        valueInput.placeholder = t("form.headers.valuePlaceholder");
        nameInput.value = name;
        valueInput.value = value;

        const lockBtn = el("button", `${ICON_BUTTON_CLASS} hover:text-primary-container`);
        lockBtn.type = "button";
        const lockIcon = el("span", "material-symbols-outlined text-[18px] block");
        lockBtn.append(lockIcon);

        const removeBtn = el("button", `${ICON_BUTTON_CLASS} hover:text-signal-error`);
        removeBtn.type = "button";
        removeBtn.title = t("form.headers.remove");
        removeBtn.append(el("span", "material-symbols-outlined text-[18px] block", "delete"));

        root.append(nameInput, valueInput, lockBtn, removeBtn);

        const row = {
            root,
            nameInput,
            valueInput,
            lockBtn,
            lockIcon,
            removeBtn,
            masked: masked ?? isSensitiveHeader(name),
            userSetLock: masked !== undefined,
        };

        nameInput.addEventListener("input", () => {
            if (!row.userSetLock) {
                row.masked = isSensitiveHeader(nameInput.value);
                renderLock(row);
            }
            onChange();
        });
        valueInput.addEventListener("input", onChange);
        nameInput.addEventListener("paste", (event) => handlePaste(event, row));
        lockBtn.addEventListener("click", () => toggleLock(row));
        removeBtn.addEventListener("click", () => removeRow(row));

        rows.push(row);
        container.append(root);
        renderLock(row);
        setRowDisabled(row);
        updateAddButton();
        return row;
    }

    // Headers to send: trimmed, empty rows left out
    function getHeaders() {
        return rows
            .map((row) => ({ name: row.nameInput.value.trim(), value: row.valueInput.value.trim(), masked: row.masked }))
            .filter((header) => header.name !== "" || header.value !== "");
    }

    // Replace all rows (rerun, reconnect, draft)
    function setHeaders(headers) {
        for (const row of [...rows]) row.root.remove();
        rows.length = 0;
        for (const header of headers ?? []) {
            addRow({ name: header.name ?? "", value: header.value ?? "", masked: header.masked === true });
        }
        updateAddButton();
        onChange();
    }

    function setDisabled(isDisabled) {
        disabled = isDisabled;
        rows.forEach(setRowDisabled);
        updateAddButton();
    }

    addButton.addEventListener("click", () => {
        addRow()?.nameInput.focus();
        onChange();
    });

    updateAddButton();

    return { getHeaders, setHeaders, setDisabled };
}