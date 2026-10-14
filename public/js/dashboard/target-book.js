// URL rehberi penceresi: kayıtlı hedefleri listeler, arar, ekler, siler.
// Satıra tıklayınca URL forma yazılır ve pencere kapanır.
// Kayıtlar az olacağı için hepsi bir kez çekilir, arama tarayıcıda anında yapılır.

import { t } from "../core/i18n.js";
import { confirmDialog } from "../core/confirm-dialog.js";
import { showToast } from "../core/toast.js";
import { apiErrorMessage } from "../core/api-error.js";
import { withDefaultScheme } from "../core/url.js";

function el(tag, className = "", text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function icon(name, className = "text-[18px]") {
    return el("span", `material-symbols-outlined block ${className}`, name);
}

function shortUrl(url) {
    return url.replace(/^https?:\/\//, "");
}

function normalize(text) {
    return text.toLocaleLowerCase("tr-TR");
}

const INPUT_CLASS =
    "w-full bg-surface-container-lowest border border-border-subtle rounded py-2 px-3 font-data-md text-data-md text-on-surface " +
    "focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container placeholder:text-on-surface-variant/50";

// getCurrentUrl: formdaki URL (yeni kayıt formunu doldurmak için)
// onSelect(url): bir kayıt seçilince
export function createTargetBook({ getCurrentUrl, onSelect }) {
    let overlay = null;
    let refs = null;
    let targets = [];

    // --- Pencerenin kurulması ---

    function build() {
        const root = el("div", "fixed inset-0 z-[60] flex items-start justify-center p-4 pt-24 bg-background/80 backdrop-blur-sm");

        const box = el(
            "div",
            "relative w-full max-w-lg bg-surface-container-lowest border border-border-subtle rounded-lg shadow-2xl flex flex-col overflow-hidden"
        );
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-modal", "true");

        // Başlık
        const header = el("div", "flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-container-low/70");
        const title = el("div", "flex items-center gap-2");
        title.append(icon("contacts", "text-[20px] text-primary-container"), el("h2", "font-headline-md text-headline-md text-on-surface", t("book.title")));

        const closeBtn = el("button", "p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-colors");
        closeBtn.type = "button";
        closeBtn.title = t("dialog.close");
        closeBtn.append(icon("close", "text-[20px]"));
        header.append(title, closeBtn);

        // Arama ve "+"
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

        // Yeni kayıt formu ("+" ile açılır)
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

        // Liste
        const list = el("div", "px-5 py-4 max-h-80 overflow-y-auto flex flex-col");

        box.append(header, toolbar, form, list);
        root.append(box);

        refs = { root, box, closeBtn, search, addBtn, form, nameInput, urlInput, formError, cancelBtn, saveBtn, list };

        // Olaylar
        closeBtn.addEventListener("click", close);
        // Sadece dışarıda basılıp dışarıda bırakılırsa kapat
        // (kutunun içinde yazı seçerken fare dışarı kayınca kapanmasın)
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

    // --- Liste ---

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
            // Pencere bu arada kapatıldıysa çizecek yer yok
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

    // --- Yeni kayıt ---

    // prefillUrl: verilirse URL alanı bununla dolar (öneriden gelindiğinde)
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

        // Test formundaki gibi: protokol yazılmadıysa "http://"
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

            // Kayıt yapıldı: pencere bu arada kapatılsa da kullanıcıya haber ver
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

    // --- Silme ---

    async function remove(target) {
        const deleted = await confirmDialog({
            title: t("book.deleteTitle"),
            message: t("book.deleteMessage"),
            details: [target.name, target.url],
            confirmLabel: t("book.deleteConfirm"),
            busyLabel: t("book.deleteBusy"),
            onConfirm: async () => {
                const response = await fetch(`/api/targets/${target.id}`, { method: "DELETE" });
                // 404: zaten silinmiş, amaca ulaşılmış sayılır
                if (!response.ok && response.status !== 404) throw new Error(t("book.deleteFailed"));
            },
        });

        if (deleted) {
            showToast(t("book.deleted"), { detail: target.name, type: "danger" });
            await load();
        }
    }

    // --- Açma / kapama ---

    // Esc: sadece rehber penceresi odaktayken kapat (üstünde onay penceresi açıksa ona bırak)
    function onKey(e) {
        if (e.key === "Escape" && overlay && overlay.contains(document.activeElement)) close();
    }

    // addUrl: verilirse pencere ekleme formu açık ve bu URL dolu olarak açılır
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