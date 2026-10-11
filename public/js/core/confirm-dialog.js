// Onay penceresi: geri alınamayan işlemlerden önce sorar.
//   - Açılınca imleç "Vazgeç"te durur (yanlışlıkla Enter'a basılırsa hiçbir şey olmaz)
//   - Esc, pencere dışına tıklama ya da "Vazgeç" kapatır
//   - requireText verilirse onay butonu, o metin yazılana kadar pasif kalır
//   - onConfirm verilirse işlem pencere açıkken yapılır; hata olursa pencerede gösterilir
//   - doneLabel verilirse işlem bitince buton kısa bir an bu metni gösterir ("✓ SİLİNDİ")
// Dönüş: Promise<boolean>, onaylanıp işlem başarılıysa true

import { t } from "./i18n.js";

function el(tag, className = "", text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Türkçe İ / I farkı yüzünden "sil", "SİL" ve "SIL" aynı kabul edilsin
function normalize(text) {
    return text.trim().toLocaleUpperCase("tr-TR").replaceAll("İ", "I");
}

const DONE_DISPLAY_MS = 700; // "✓ SİLİNDİ" yazısının görünme süresi

export function confirmDialog({ title, message, details = [], confirmLabel, busyLabel, doneLabel, requireText = null, onConfirm }) {
    return new Promise((resolve) => {
        const previousFocus = document.activeElement;
        let busy = false;

        // --- Pencere ---
        const overlay = el("div", "fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm");
        const box = el("div", "relative w-full max-w-md bg-surface-container-lowest border border-border-subtle rounded-lg shadow-2xl flex flex-col overflow-hidden");
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-modal", "true");

        const bar = el("div", "absolute top-0 left-0 w-full h-1 bg-signal-error");

        const body = el("div", "p-6 flex flex-col gap-4");

        const heading = el("div", "flex items-center gap-2");
        heading.append(
            el("span", "material-symbols-outlined text-signal-error text-[22px]", "warning"),
            el("h2", "font-headline-md text-headline-md text-on-surface", title)
        );
        body.append(heading, el("p", "font-body-md text-body-md text-on-surface-variant", message));

        if (details.length > 0) {
            const detailBox = el("div", "border border-border-subtle bg-surface-container-low rounded px-3 py-2 flex flex-col gap-1 font-data-md text-[13px] text-on-surface break-all");
            details.forEach((line) => detailBox.append(el("span", "", line)));
            body.append(detailBox);
        }

        let input = null;
        if (requireText) {
            const field = el("label", "flex flex-col gap-2 font-data-md text-[13px] text-on-surface-variant");
            field.append(t("dialog.typeToConfirm", { text: requireText }));
            input = el(
                "input",
                "w-full bg-surface-container-lowest border border-border-subtle rounded py-2 px-3 font-data-md text-data-md text-on-surface focus:outline-none focus:border-signal-error focus:ring-1 focus:ring-signal-error"
            );
            input.type = "text";
            input.autocomplete = "off";
            field.append(input);
            body.append(field);
        }

        const errorText = el("p", "font-data-md text-[13px] text-signal-error");
        errorText.hidden = true;
        body.append(errorText);

        // --- Butonlar ---
        const footer = el("div", "px-6 py-4 border-t border-border-subtle bg-surface-container-low/70 flex items-center justify-end gap-3");

        const cancelBtn = el(
            "button",
            "px-4 py-2 border border-border-subtle text-on-surface-variant hover:text-on-surface hover:bg-surface-variant font-label-caps text-label-caps rounded transition-colors disabled:opacity-50",
            t("dialog.cancel")
        );
        cancelBtn.type = "button";
        footer.append(cancelBtn);

        let confirmBtn = null;
        if (confirmLabel) {
            confirmBtn = el(
                "button",
                "px-4 py-2 bg-signal-error text-[#000000] font-label-caps text-label-caps font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed",
                confirmLabel
            );
            confirmBtn.type = "button";
            confirmBtn.disabled = Boolean(requireText);
            footer.append(confirmBtn);
        }

        box.append(bar, body, footer);
        overlay.append(box);

        // --- Davranış ---
        function close(result) {
            document.removeEventListener("keydown", onKey);
            overlay.remove();
            document.body.style.overflow = "";
            previousFocus?.focus?.();
            resolve(result);
        }

        function onKey(e) {
            if (e.key === "Escape" && !busy) close(false);
        }

        // Sadece dışarıda basılıp dışarıda bırakılırsa kapat
        // (kutunun içinde yazı seçerken fare dışarı kayınca kapanmasın)
        let pressedOnBackdrop = false;
        overlay.addEventListener("mousedown", (e) => {
            pressedOnBackdrop = e.target === overlay;
        });
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay && pressedOnBackdrop && !busy) close(false);
        });

        cancelBtn.addEventListener("click", () => close(false));

        input?.addEventListener("input", () => {
            confirmBtn.disabled = normalize(input.value) !== normalize(requireText);
        });

        confirmBtn?.addEventListener("click", async () => {
            if (!onConfirm) return close(true);

            busy = true;
            errorText.hidden = true;
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;
            if (input) input.disabled = true;
            confirmBtn.textContent = busyLabel ?? confirmLabel;

            try {
                await onConfirm();
                // İşlem bitti: kısa bir an "✓ SİLİNDİ" göster, sonra kapat
                if (doneLabel) {
                    confirmBtn.textContent = doneLabel;
                    await new Promise((r) => setTimeout(r, DONE_DISPLAY_MS));
                }
                close(true);
            } catch (err) {
                busy = false;
                errorText.textContent = err.message;
                errorText.hidden = false;
                confirmBtn.textContent = confirmLabel;
                confirmBtn.disabled = false;
                cancelBtn.disabled = false;
                if (input) input.disabled = false;
            }
        });

        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        document.body.append(overlay);
        (input ?? cancelBtn).focus();
    });
}