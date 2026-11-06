// body-builder.js
// "Random user" dialog: builds a JSON Body from fields, each one a variable ({{email}}...) or a fixed text.
//   - Opens with 3 rows every time (email, username, password); it doesn't read the current body
//   - The preview shows the body with sample values; the body itself gets "{{email}}" etc.
//   - "Write to body" replaces the body (asks first if it isn't empty)
//   - Rows are reordered by dragging their handle, or with Alt+↑ / Alt+↓ while the handle has focus
// The result is an ordinary body: the server fills the variables the same way as typed ones.

import { t } from "../core/i18n.js";
import { el } from "../core/dom.js";
import { confirmDialog } from "../core/confirm-dialog.js";
import { renderJson } from "../core/json-highlight.js";

const MAX_FIELDS = 20;
const MAX_NAME_LENGTH = 100;

// Reordering: how long a row slides, how far the pointer moves before a drag starts,
// and the list's auto-scroll near its edges (distance from the edge, pixels per frame)
const SLIDE_MS = 150;
const DRAG_THRESHOLD_PX = 3;
const AUTO_SCROLL_EDGE = 24;
const AUTO_SCROLL_SPEED = 6;

// Field types in the order of the list; all but "constant" are variables of the same name
const TYPES = ["email", "username", "name", "password", "n", "uuid", "constant"];

// Values shown in the preview, in the shape of the real ones (src/engine/variables.ts)
const SAMPLE_VALUES = {
    email: "volta-a1b2c3-1@volta.test",
    username: "volta_a1b2c3_1",
    name: "Alex Morgan",
    password: "Kp7#mQ2xWv9L",
    n: "1",
    uuid: "3f2b8c1e-9a4d-4e7b-8c2a-5d6f7e8a9b0c",
};

const DEFAULT_FIELDS = [
    { name: "email", type: "email" },
    { name: "username", type: "username" },
    { name: "password", type: "password" },
];

const INPUT_CLASS =
    "min-w-0 bg-surface-container-lowest border border-border-subtle py-1.5 px-2 font-data-md text-[13px] focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all";
const ICON_BUTTON_CLASS =
    "shrink-0 p-1 rounded text-on-surface-variant hover:bg-surface-variant hover:text-signal-error transition-colors";

function icon(name, className = "text-[18px]") {
    return el("span", `material-symbols-outlined block ${className}`, name);
}

// getBody(): the text in the JSON Body box. onWrite(text): put the built body into it.
export function createBodyBuilder({ getBody, onWrite }) {
    let overlay = null;
    let refs = null;
    let rows = [];
    let previousFocus = null;

    // --- Building the dialog ---

    function build() {
        const root = el("div", "fixed inset-0 z-[60] flex items-start justify-center p-4 pt-24 bg-background/80 backdrop-blur-sm");

        const box = el(
            "div",
            "relative w-full max-w-lg bg-surface-container-lowest border border-border-subtle rounded-lg shadow-2xl flex flex-col overflow-hidden"
        );
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-modal", "true");

        // Title
        const header = el("div", "flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-container-low/70");
        const title = el("div", "flex items-center gap-2");
        title.append(icon("person_add", "text-[20px] text-primary-container"), el("h2", "font-headline-md text-headline-md text-on-surface", t("builder.title")));

        const closeBtn = el("button", "p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-colors");
        closeBtn.type = "button";
        closeBtn.title = t("dialog.close");
        closeBtn.append(icon("close", "text-[20px]"));
        header.append(title, closeBtn);

        // Fields
        const content = el("div", "px-5 py-4 flex flex-col gap-3");

        // relative: the rows' offsetTop is measured from the list (for dragging)
        const list = el("div", "relative max-h-64 overflow-y-auto flex flex-col gap-2");
        const empty = el("p", "font-data-md text-[13px] text-signal-error", t("builder.noFields"));
        empty.hidden = true;

        const addBtn = el(
            "button",
            "self-start flex items-center gap-1 font-data-md text-[12px] text-secondary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        );
        addBtn.type = "button";
        addBtn.append(icon("add", "text-[16px]"), el("span", "", t("builder.add")));

        // Preview
        const previewLabel = el("p", "font-data-md text-[12px] text-on-surface-variant", t("builder.preview"));
        const preview = el(
            "pre",
            "max-h-48 overflow-auto border border-border-subtle bg-surface-container-low rounded px-3 py-2 font-data-md text-[12px] leading-relaxed text-secondary whitespace-pre-wrap break-all transition-opacity"
        );
        const previewNote = el("p", "font-data-md text-[11px] leading-snug text-outline", t("builder.previewNote"));

        content.append(list, empty, addBtn, previewLabel, preview, previewNote);

        // Buttons
        const footer = el("div", "px-5 py-4 border-t border-border-subtle bg-surface-container-low/70 flex items-center justify-end gap-3");
        const cancelBtn = el(
            "button",
            "px-4 py-2 border border-border-subtle text-on-surface-variant hover:text-on-surface hover:bg-surface-variant font-label-caps text-label-caps rounded transition-colors",
            t("dialog.cancel")
        );
        cancelBtn.type = "button";
        const writeBtn = el(
            "button",
            "px-4 py-2 bg-primary-container text-[#000000] font-label-caps text-label-caps font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed",
            t("builder.write")
        );
        writeBtn.type = "button";
        footer.append(cancelBtn, writeBtn);

        box.append(header, content, footer);
        root.append(box);

        refs = { root, list, empty, addBtn, preview, writeBtn };

        // Events
        closeBtn.addEventListener("click", close);
        cancelBtn.addEventListener("click", close);
        // Close only if pressed and released outside
        // (so it doesn't close when the mouse slips outside while selecting text in the box)
        let pressedOnBackdrop = false;
        root.addEventListener("mousedown", (e) => {
            pressedOnBackdrop = e.target === root;
        });
        root.addEventListener("click", (e) => {
            if (e.target === root && pressedOnBackdrop) close();
        });
        addBtn.addEventListener("click", () => {
            addRow({ name: "", type: "constant" })?.nameInput.focus();
            update();
        });
        writeBtn.addEventListener("click", write);

        return root;
    }

    // --- Reordering ---
    // With the pointer: the row floats under the pointer (position fixed), an empty placeholder of the same height
    // keeps its place in the list, and the other rows slide to make room. The list's height never changes, so
    // dragging doesn't bring up a scrollbar. Rows slide with a short transform transition (FLIP).

    function reduceMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    // FLIP: note where the elements are, change the order (mutate), then animate each from its old place to the new one
    function slide(elements, mutate) {
        const before = new Map(elements.map((element) => [element, element.getBoundingClientRect().top]));
        mutate();
        if (reduceMotion()) return;
        for (const element of elements) {
            const delta = before.get(element) - element.getBoundingClientRect().top;
            if (delta === 0) continue;
            element.style.transition = "none";
            element.style.transform = `translateY(${delta}px)`;
            element.getBoundingClientRect(); // Apply the start position before the transition
            element.style.transition = `transform ${SLIDE_MS}ms ease`;
            element.style.transform = "";
        }
    }

    // The rows' order follows the list's elements (after a move)
    function syncRowOrder() {
        const byRoot = new Map(rows.map((row) => [row.root, row]));
        rows = [...refs.list.children].map((child) => byRoot.get(child)).filter(Boolean);
    }

    // Alt+↑ / Alt+↓: one step, with the same slide
    function moveRowBy(row, step) {
        const index = rows.indexOf(row);
        const target = index + step;
        if (target < 0 || target >= rows.length) return;
        slide(
            rows.map((r) => r.root),
            () => refs.list.insertBefore(row.root, step < 0 ? rows[target].root : rows[target].root.nextSibling)
        );
        syncRowOrder();
        update();
    }

    let drag = null; // { row, placeholder, grabOffset, startTop, pointerY, frame }

    function startDrag(row, pointerY) {
        const list = refs.list;
        const rect = row.root.getBoundingClientRect();

        // An empty place of the same height stays in the list
        const placeholder = el("div", "shrink-0 rounded border border-dashed border-border-subtle");
        placeholder.style.height = `${rect.height}px`;
        list.insertBefore(placeholder, row.root);

        // No scrollbar because of the drag: if the list doesn't scroll now, it can't while dragging either
        if (list.scrollHeight <= list.clientHeight) list.style.overflowY = "hidden";

        // The row floats above the dialog (outside the list, so the list's scrolling doesn't clip it)
        Object.assign(row.root.style, {
            position: "fixed",
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            zIndex: "70",
            pointerEvents: "none",
            transition: "none",
            transform: "",
        });
        row.root.classList.add("bg-surface-container-low", "shadow-2xl", "rounded", "ring-1", "ring-border-subtle");
        refs.root.append(row.root);
        refs.root.style.cursor = "grabbing";

        drag = { row, placeholder, grabOffset: pointerY - rect.top, startTop: rect.top, pointerY, frame: null };
        drag.frame = requestAnimationFrame(autoScroll);
    }

    // The floating row follows the pointer; the placeholder moves to where its middle is
    function moveDrag(pointerY) {
        drag.pointerY = pointerY;
        drag.row.root.style.transform = `translateY(${pointerY - drag.grabOffset - drag.startTop}px)`;
        placePlaceholder();
    }

    // Before the first row whose middle is below the floating row's middle (layout positions, without transforms)
    function placePlaceholder() {
        const list = refs.list;
        const listTop = list.getBoundingClientRect().top - list.scrollTop;
        const middle = drag.pointerY - drag.grabOffset + drag.placeholder.offsetHeight / 2;
        const others = [...list.children].filter((child) => child !== drag.placeholder);
        const next = others.find((child) => middle < listTop + child.offsetTop + child.offsetHeight / 2) ?? null;
        if (drag.placeholder.nextSibling === next) return;
        slide([...list.children], () => list.insertBefore(drag.placeholder, next));
    }

    // Near the list's top or bottom edge the list scrolls by itself (only if it can scroll)
    function autoScroll() {
        if (!drag) return;
        const list = refs.list;
        const rect = list.getBoundingClientRect();
        let speed = 0;
        if (drag.pointerY < rect.top + AUTO_SCROLL_EDGE) speed = -AUTO_SCROLL_SPEED;
        else if (drag.pointerY > rect.bottom - AUTO_SCROLL_EDGE) speed = AUTO_SCROLL_SPEED;
        if (speed !== 0 && list.scrollHeight > list.clientHeight) {
            const previous = list.scrollTop;
            list.scrollTop += speed;
            if (list.scrollTop !== previous) placePlaceholder();
        }
        drag.frame = requestAnimationFrame(autoScroll);
    }

    // Drop: the row slides into the placeholder's place, then takes it over
    function endDrag() {
        if (!drag) return;
        const { row, placeholder, startTop, frame } = drag;
        drag = null;
        cancelAnimationFrame(frame);
        refs.root.style.cursor = "";

        const settle = () => {
            if (!refs) return;
            placeholder.replaceWith(row.root);
            row.root.classList.remove("bg-surface-container-low", "shadow-2xl", "rounded", "ring-1", "ring-border-subtle");
            for (const property of ["position", "left", "top", "width", "zIndex", "pointerEvents", "transition", "transform"]) {
                row.root.style[property] = "";
            }
            refs.list.style.overflowY = "";
            syncRowOrder();
            update();
        };

        if (reduceMotion()) {
            settle();
            return;
        }
        row.root.style.transition = `transform ${SLIDE_MS}ms ease`;
        row.root.style.transform = `translateY(${placeholder.getBoundingClientRect().top - startTop}px)`;
        setTimeout(settle, SLIDE_MS);
    }

    // Pointer events on the document while dragging: the row (with its handle) moves in the page, so pointer capture would be lost
    function onPointerMove(e) {
        if (!drag) return;
        e.preventDefault();
        moveDrag(e.clientY);
    }

    function onPointerUp() {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointercancel", onPointerUp);
        endDrag();
    }

    // Starts only after a few pixels of movement, so a simple click on the handle doesn't move anything
    function onHandlePointerDown(e, row) {
        if (e.button !== 0 || drag) return;
        // No text selection while dragging, and no focus ring from the mouse
        e.preventDefault();
        const startY = e.clientY;

        const waitForMove = (move) => {
            if (Math.abs(move.clientY - startY) < DRAG_THRESHOLD_PX) return;
            stopWaiting();
            startDrag(row, startY);
            moveDrag(move.clientY);
            document.addEventListener("pointermove", onPointerMove);
            document.addEventListener("pointerup", onPointerUp);
            document.addEventListener("pointercancel", onPointerUp);
        };
        const stopWaiting = () => {
            document.removeEventListener("pointermove", waitForMove);
            document.removeEventListener("pointerup", stopWaiting);
            document.removeEventListener("pointercancel", stopWaiting);
        };
        document.addEventListener("pointermove", waitForMove);
        document.addEventListener("pointerup", stopWaiting);
        document.addEventListener("pointercancel", stopWaiting);
    }

    // --- Rows ---

    function addRow({ name, type }) {
        if (rows.length >= MAX_FIELDS) return null;

        const root = el("div", "flex flex-col gap-1");
        const line = el("div", "flex items-center gap-1.5");

        // Only the handle drags, so selecting and typing in the inputs works as usual.
        // The focus ring shows only for keyboard focus (focus-visible), as a small round ring around the icon.
        const handle = el(
            "span",
            "material-symbols-outlined block shrink-0 text-[18px] leading-none p-0.5 text-outline hover:text-on-surface cursor-grab touch-none select-none rounded-lg outline-none focus-visible:ring-1 focus-visible:ring-primary-container",
            "drag_indicator"
        );
        handle.tabIndex = 0;
        handle.setAttribute("role", "button");
        handle.title = t("builder.dragHandle");
        handle.setAttribute("aria-label", t("builder.dragHandle"));

        const nameInput = el("input", `${INPUT_CLASS} w-[38%] text-on-surface`);
        nameInput.type = "text";
        nameInput.autocomplete = "off";
        nameInput.spellcheck = false;
        nameInput.maxLength = MAX_NAME_LENGTH;
        nameInput.placeholder = t("builder.fieldPlaceholder");
        nameInput.value = name;

        const typeSelect = el("select", `${INPUT_CLASS} flex-1 text-on-surface`);
        for (const value of TYPES) {
            const option = el("option", "", t(`builder.type.${value}`));
            option.value = value;
            typeSelect.append(option);
        }
        typeSelect.value = type;

        const valueInput = el("input", `${INPUT_CLASS} flex-1 text-on-surface`);
        valueInput.type = "text";
        valueInput.autocomplete = "off";
        valueInput.spellcheck = false;
        valueInput.placeholder = t("builder.valuePlaceholder");

        const removeBtn = el("button", ICON_BUTTON_CLASS);
        removeBtn.type = "button";
        removeBtn.title = t("builder.remove");
        removeBtn.append(icon("delete"));

        const error = el("p", "font-data-md text-[12px] text-signal-error");
        error.hidden = true;

        line.append(handle, nameInput, typeSelect, valueInput, removeBtn);
        root.append(line, error);

        const row = { root, nameInput, typeSelect, valueInput, removeBtn, error };

        handle.addEventListener("pointerdown", (e) => onHandlePointerDown(e, row));
        handle.addEventListener("keydown", (e) => {
            if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
            e.preventDefault();
            moveRowBy(row, e.key === "ArrowUp" ? -1 : 1);
            // Moving the element can take the focus away; keep it on the handle so it can be moved again
            handle.focus();
        });

        nameInput.addEventListener("input", update);
        valueInput.addEventListener("input", update);
        typeSelect.addEventListener("change", update);
        removeBtn.addEventListener("click", () => {
            row.root.remove();
            rows.splice(rows.indexOf(row), 1);
            // The removed button had the focus: keep it in the dialog (Esc works only while it's there)
            refs.addBtn.focus();
            update();
        });

        rows.push(row);
        refs.list.append(root);
        return row;
    }

    // The error of each row (null if it's fine), in the order of the rows
    function rowErrors() {
        const names = rows.map((row) => row.nameInput.value.trim());
        return names.map((name, index) => {
            if (name === "") return t("builder.error.nameEmpty");
            if (name.length > MAX_NAME_LENGTH) return t("builder.error.nameTooLong", { max: MAX_NAME_LENGTH });
            if (names.indexOf(name) !== index) return t("builder.error.nameDuplicate");
            return null;
        });
    }

    // The body as an object. valueOf(type, row): what goes into each field.
    // Object.fromEntries keeps even a field named "__proto__" as a normal field.
    function buildObject(valueOf) {
        return Object.fromEntries(rows.map((row) => [row.nameInput.value.trim(), valueOf(row.typeSelect.value, row)]));
    }

    // After every change: the value inputs, the errors, the preview and the buttons
    function update() {
        const errors = rowErrors();
        rows.forEach((row, index) => {
            row.valueInput.hidden = row.typeSelect.value !== "constant";
            row.error.textContent = errors[index] ?? "";
            row.error.hidden = !errors[index];
            row.nameInput.classList.toggle("border-signal-error", Boolean(errors[index]));
            row.nameInput.classList.toggle("border-border-subtle", !errors[index]);
        });

        const valid = rows.length > 0 && errors.every((error) => error === null);
        refs.empty.hidden = rows.length > 0;
        refs.addBtn.disabled = rows.length >= MAX_FIELDS;
        refs.addBtn.title = refs.addBtn.disabled ? t("builder.maxFields", { max: MAX_FIELDS }) : "";
        refs.writeBtn.disabled = !valid;

        // While something is wrong the last valid preview stays, dimmed
        refs.preview.classList.toggle("opacity-40", !valid);
        if (valid) {
            const sample = buildObject((type, row) => (type === "constant" ? row.valueInput.value : SAMPLE_VALUES[type]));
            renderJson(refs.preview, JSON.stringify(sample, null, 2));
        } else if (rows.length === 0) {
            renderJson(refs.preview, "{}");
        }
    }

    // --- Writing ---

    async function write() {
        if (!refs || refs.writeBtn.disabled) return;

        // Variables as "{{email}}", fixed values as typed (JSON.stringify escapes quotes and backslashes)
        const text = JSON.stringify(
            buildObject((type, row) => (type === "constant" ? row.valueInput.value : `{{${type}}}`)),
            null,
            2
        );

        if (getBody().trim() !== "") {
            const confirmed = await confirmDialog({
                title: t("builder.replaceTitle"),
                message: t("builder.replaceMessage"),
                confirmLabel: t("builder.replaceConfirm"),
            });
            if (!confirmed) return;
        }

        onWrite(text);
        close();
    }

    // --- Open / close ---

    // Esc: close only while this dialog has focus (if a confirmation dialog is open on top, leave it to that)
    function onKey(e) {
        if (e.key !== "Escape" || !overlay) return;
        // While dragging, Esc only drops the row (where its placeholder is)
        if (drag) {
            onPointerUp();
            return;
        }
        if (overlay.contains(document.activeElement)) close();
    }

    function open() {
        if (overlay) return;
        previousFocus = document.activeElement;
        overlay = build();
        rows = [];
        DEFAULT_FIELDS.forEach(addRow);
        update();

        document.body.append(overlay);
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", onKey);
        rows[0].nameInput.focus();
    }

    function close() {
        if (!overlay) return;
        if (drag) onPointerUp();
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        overlay = null;
        refs = null;
        rows = [];
        document.body.style.overflow = "";
        previousFocus?.focus?.();
    }

    return { open };
}
