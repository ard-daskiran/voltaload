// save-suggestion.js
// Test bitince "bu adresi rehbere kaydetmek ister misin?" önerisi.
// Kurallar:
//   - URL rehberde kayıtlı değilse ve en az MIN_RUNS kez test edilmişse (bu test dahil)
//   - "Hayır" denirse o URL için bir daha sorulmaz (tarayıcıda saklanır)
//   - Cevap verilmezse 10 sn sonra kaybolur, sonraki testte yine sorulabilir

import { t } from "../core/i18n.js";
import { showToast } from "../core/toast.js";
import { shortUrl } from "../core/url.js";

const MIN_RUNS = 2; // 1 yapılırsa ilk testte de sorar
const SUGGEST_DURATION_MS = 10_000;
const DISMISSED_KEY = "volta-dismissed-suggestions";
const MAX_DISMISSED = 200;

function readDismissed() {
    try {
        const list = JSON.parse(localStorage.getItem(DISMISSED_KEY));
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function dismiss(url) {
    try {
        const list = readDismissed().filter((u) => u !== url);
        list.push(url);
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(list.slice(-MAX_DISMISSED)));
    } catch {
        // Tarayıcı hafızası kullanılamıyorsa sadece bu sefer kapanır
    }
}

// onSave(url): "Kaydet"e basılınca (rehberi ekleme formuyla açar)
export function createSaveSuggestion({ onSave }) {
    async function maybeSuggest(url) {
        if (!url || readDismissed().includes(url)) return;

        try {
            const response = await fetch(`/api/targets/suggest?url=${encodeURIComponent(url)}`);
            if (!response.ok) return;

            const { saved, runCount } = await response.json();
            if (saved || runCount < MIN_RUNS) return;

            showToast(t("suggest.title"), {
                detail: shortUrl(url),
                type: "info",
                durationMs: SUGGEST_DURATION_MS,
                actions: [
                    { label: t("suggest.no"), onClick: () => dismiss(url) },
                    { label: t("suggest.save"), primary: true, onClick: () => onSave(url) },
                ],
            });
        } catch (err) {
            // Öneri isteğe bağlı bir kolaylık, hata olursa sessizce geç
            console.error(err);
        }
    }

    return { maybeSuggest };
}