// Target book dialog: lists, searches, adds and deletes saved targets.
// Clicking a row writes the URL into the form and closes the dialog.
// Since there will be few entries, they're all fetched once and search runs instantly in the browser.

import { t } from "../core/i18n.js";
import { confirmDialog } from "../core/confirm-dialog.js";
import { showToast } from "../core/toast.js";
import { apiErrorMessage } from "../core/api-error.js";
import { withDefaultScheme, shortUrl } from "../core/url.js";
import { el } from "../core/dom.js";


function icon(name, className = "text-[18px]") {
    return el("span", `material-symbols-outlined block ${className}`, name);
}

function normalize(text) {
    return text.toLocaleLowerCase("tr-TR");
}

const INPUT_CLASS =
    "w-full bg-surface-container-lowest border border-border-subtle rounded py-2 px-3 font-data-md text-data-md text-on-surface " +
    "focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container placeholder:text-on-surface-variant/50";

// getCurrentUrl: the URL in the form (to prefill the new entry form)
// onSelect(url): when an entry is selected
export function createTargetBook({ getCurrentUrl, onSelect }) {
    let overlay = null;
    let refs = null;
    let targets = [];

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
        title.append(icon("contacts", "text-[20px] text-primary-container"), el("h2", "font-headline-md text-headline-md text-on-surface", t("book.title")));

        const closeBtn = el("button", "p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-colors");
        closeBtn.type = "button";
        closeBtn.title = t("dialog.close");
        closeBtn.append(icon("close", "text-[20px]"));
        header.append(title, closeBtn);

        // Search and "+"
        const toolbar = el("div", "flex gap-2 px-5 pt-4");
        const searchWrap = el("div", "relative flex-1");
        const searchIcon = icon("search", "text-[18px] text-on-surface-variant");
        searchIcon.classList.add("absolute", "left-3", "top-1/2", "-translate-y-1/2", "pointer-events-none");
        const search = el("input", `${INPUT_CLASS} pl-10`);
        search.type = "text";
        search.autocomplete = "off";
        search.placeholder = t("book.searchPlaceholder");
        searchWrap.append(searchIcon, search);

        const addBtn = el(
            "button",
            "px-3 rounded border border-secondary text-secondary hover:bg-secondary/10 transition-colors flex items-center"
        );
        addBtn.type = "button";
        addBtn.title = t("book.add");
        addBtn.append(icon("add", "text-[20px]"));
        toolbar.append(searchWrap, addBtn);

        // New entry form (opened with "+")
        const form = el("div", "mx-5 mt-3 border border-border-subtle bg-surface-container-low rounded p-3 flex flex-col gap-3");
        form.hidden = true;

        const nameLabel = el("label", "flex flex-col gap-1.5 font-data-md text-[12px] text-on-surface-variant", t("book.name"));
        const nameInput = el("input", INPUT_CLASS);
        nameInput.type = "text";
        nameInput.maxLength = 40;
        nameInput.autocomplete = "off";
        nameInput.placeholder = t("book.namePlaceholder");
        nameLabel.append(nameInput);

        const urlLabel = el("label", "flex flex-col gap-1.5 font-data-md text-[12px] text-on-surface-variant", t("book.url"));
        const urlInput = el("input", INPUT_CLASS);
        urlInput.type = "text";
        urlInput.autocomplete = "off";
        urlInput.spellcheck = false;
        urlLabel.append(urlInput);

        const formError = el("p", "font-data-md text-[12px] text-signal-error");
        formError.hidden = true;

        const formActions = el("div", "flex justify-end gap-2");
        const cancelBtn = el(
            "button",
            "px-3 py-1.5 border border-border-subtle text-on-surface-variant hover:text-on-surface hover:bg-surface-variant font-label-caps text-[11px] rounded transition-colors",
            t("dialog.cancel")
        );
        cancelBtn.type = "button";
        const saveBtn = el(
            "button",
            "px-3 py-1.5 bg-primary-container text-[#000000] font-label-caps text-[11px] font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50",
            t("book.save")
        );
        saveBtn.type = "button";
        formActions.append(cancelBtn, saveBtn);

        form.append(nameLabel, urlLabel, formError, formActions);

        // List
        const list = el("div", "px-5 py-4 max-h-80 overflow-y-auto flex flex-col");

        box.append(header, toolbar, form, list);
        root.append(box);

        refs = { root, box, closeBtn, search, addBtn, form, nameInput, urlInput, formError, cancelBtn, saveBtn, list };

        // Events
        closeBtn.addEventListener("click", close);
        // Close only if pressed and released outside
        // (so it doesn't close when the mouse slips outside while selecting text in the box)
        let pressedOnBackdrop = false;
        root.addEventListener("mousedown", (e) => {
            pressedOnBackdrop = e.target === root;
        });
        root.addEventListener("click", (e) => {
            if (e.target === root && pressedOnBackdrop) close();
        });
        search.addEventListener("input", renderList);
        addBtn.addEventListener("click", () => toggleForm(refs.form.hidden));
        cancelBtn.addEventListener("click", () => toggleForm(false));
        saveBtn.addEventListener("click", save);
        for (const input of [nameInput, urlInput]) {
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") save();
            });
        }

        return root;
    }

    // --- List ---

    function message(text, isError = false) {
        refs.list.replaceChildren(el("p", `py-6 text-center font-data-md text-[13px] ${isError ? "text-signal-error" : "text-on-surface-variant"}`, text));
    }

    async function load() {
        if (!refs) return;
        message(t("book.loading"));
        try {
            const response = await fetch("/api/targets");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            targets = await response.json();
            // If the dialog was closed in the meantime, there's nowhere to render
            if (refs) renderList();
        } catch (err) {
            console.error(err);
            if (refs) message(t("book.loadError"), true);
        }
    }

    function row(target) {
        const item = el(
            "div",
            "group flex items-center gap-3 px-3 py-2.5 -mx-3 rounded cursor-pointer hover:bg-secondary/10 transition-colors border-b border-border-subtle last:border-b-0"
        );

        const text = el("div", "flex-1 min-w-0 flex flex-col");
        text.append(
            el("span", "font-data-md text-data-md text-on-surface group-hover:text-secondary truncate", target.name),
            el("span", "font-data-md text-[12px] text-on-surface-variant/70 truncate", shortUrl(target.url))
        );
        text.lastChild.title = target.url;

        const del = el("button", "shrink-0 p-1.5 rounded text-on-surface-variant/50 hover:text-signal-error hover:bg-signal-error/10 transition-colors");
        del.type = "button";
        del.title = t("book.delete");
        del.append(icon("delete"));
        del.addEventListener("click", (e) => {
            e.stopPropagation();
            remove(target);
        });

        item.append(text, del);
        item.addEventListener("click", () => {
            onSelect(target.url);
            close();
        });
        return item;
    }

    function renderList() {
        if (targets.length === 0) return message(t("book.empty"));

        const query = normalize(refs.search.value.trim());
        const filtered = query
            ? targets.filter((target) => normalize(target.name).includes(query) || normalize(target.url).includes(query))
            : targets;

        if (filtered.length === 0) return message(t("book.noMatch"));
        refs.list.replaceChildren(...filtered.map(row));
    }

    // --- New entry ---

    // prefillUrl: if given, the URL field is filled with it (when coming from the suggestion)
    function toggleForm(show, prefillUrl) {
        refs.form.hidden = !show;
        refs.formError.hidden = true;

        if (show) {
            refs.nameInput.value = "";
            refs.urlInput.value = prefillUrl ?? (getCurrentUrl().trim() || "http://");
            refs.nameInput.focus();
        } else {
            refs.search.focus();
        }
    }

    async function save() {
        if (!refs || refs.saveBtn.disabled) return;

        refs.formError.hidden = true;
        refs.saveBtn.disabled = true;
        refs.saveBtn.textContent = t("book.saving");

        // Same as the test form: "http://" if no protocol was typed
        const url = withDefaultScheme(refs.urlInput.value);
        refs.urlInput.value = url;

        try {
            const response = await fetch("/api/targets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: refs.nameInput.value, url }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (refs) {
                    refs.formError.textContent = apiErrorMessage(data, "book.saveFailed");
                    refs.formError.hidden = false;
                }
                return;
            }

            // Saved: let the user know even if the dialog was closed in the meantime
            showToast(t("book.saved", { name: data.name }), { detail: shortUrl(data.url) });
            if (refs) {
                toggleForm(false);
                await load();
            }
        } catch (err) {
            console.error(err);
            if (refs) {
                refs.formError.textContent = t("book.saveFailed");
                refs.formError.hidden = false;
            }
        } finally {
            if (refs) {
                refs.saveBtn.disabled = false;
                refs.saveBtn.textContent = t("book.save");
            }
        }
    }

    // --- Deleting ---

    async function remove(target) {
        const deleted = await confirmDialog({
            title: t("book.deleteTitle"),
            message: t("book.deleteMessage"),
            details: [target.name, target.url],
            confirmLabel: t("book.deleteConfirm"),
            busyLabel: t("book.deleteBusy"),
            onConfirm: async () => {
                const response = await fetch(`/api/targets/${target.id}`, { method: "DELETE" });
                // 404: already deleted, which counts as success
                if (!response.ok && response.status !== 404) throw new Error(t("book.deleteFailed"));
            },
        });

        if (deleted) {
            showToast(t("book.deleted"), { detail: target.name, type: "danger" });
            await load();
        }
    }

    // --- Open / close ---

    // Esc: close only while the target book dialog has focus (if a confirmation dialog is open on top, leave it to that)
    function onKey(e) {
        if (e.key === "Escape" && overlay && overlay.contains(document.activeElement)) close();
    }

    // addUrl: if given, the dialog opens with the add form open and this URL filled in
    function open({ addUrl } = {}) {
        if (overlay) return;
        overlay = build();
        document.body.append(overlay);
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", onKey);
        load();

        if (addUrl) toggleForm(true, addUrl);
        else refs.search.focus();
    }

    function close() {
        if (!overlay) return;
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        overlay = null;
        refs = null;
        document.body.style.overflow = "";
    }

    return { open };
}