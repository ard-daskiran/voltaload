// Bildirim kutusu (toast): sağ altta birkaç saniye görünür, sonra solar.
//   type: "success" (cyan ✓), "error" (kırmızı), "danger" (kırmızı, silme), "info" (sarı, soru)
//   actions: [{ label, primary, onClick }] → butonlu bildirim; butona basınca bildirim kapanır
//   Fare üzerindeyken süre durur, kullanıcı okurken kaybolmaz.
// Başka bir sayfada gösterilecek bildirim için queueToast → o sayfa açılınca showQueuedToast.
// Görünme/kaybolma animasyonu doğrudan stil ile (Tailwind'in sınıfları geç uygulamasından etkilenmesin).

const FLASH_KEY = "volta-flash";
const DEFAULT_DURATION_MS = 3000;
const FADE_MS = 200;

const STYLES = {
    success: { icon: "check_circle", color: "#64d8d7" },
    error: { icon: "error", color: "#ff5555" },
    danger: { icon: "delete", color: "#ff5555" },
    info: { icon: "bookmark_add", color: "#f4c21a" },
};

let container = null;

function getContainer() {
    if (!container) {
        container = document.createElement("div");
        container.className = "fixed bottom-6 right-6 z-[70] flex flex-col items-end gap-2 pointer-events-none";
        document.body.append(container);
    }
    return container;
}

function actionButton({ label, primary }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = primary
        ? "px-3 py-1.5 bg-primary-container text-[#000000] font-label-caps text-[11px] font-bold rounded hover:opacity-90 transition-opacity"
        : "px-3 py-1.5 border border-border-subtle text-on-surface-variant hover:text-on-surface hover:bg-surface-variant font-label-caps text-[11px] rounded transition-colors";
    btn.textContent = label;
    return btn;
}

// message: ana metin, detail: altında küçük açıklama (isteğe bağlı)
// Dönüş: { close } (bildirimi elle kapatmak için)
export function showToast(message, { detail, type = "success", durationMs = DEFAULT_DURATION_MS, actions = [] } = {}) {
    const style = STYLES[type] ?? STYLES.success;

    const card = document.createElement("div");
    card.className =
        "pointer-events-auto flex items-start gap-3 min-w-[260px] max-w-sm bg-surface-container-lowest border border-border-subtle rounded shadow-lg px-4 py-3";
    card.setAttribute("role", "status");
    card.style.borderLeft = `2px solid ${style.color}`;
    card.style.opacity = "0";
    card.style.transform = "translateY(8px)";
    card.style.transition = `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`;

    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined text-[20px] shrink-0";
    icon.style.color = style.color;
    icon.textContent = style.icon;

    const text = document.createElement("div");
    text.className = "flex flex-col gap-0.5 min-w-0 flex-1";

    const title = document.createElement("span");
    title.className = "font-data-md text-data-md text-on-surface";
    title.textContent = message;
    text.append(title);

    if (detail) {
        const sub = document.createElement("span");
        sub.className = "font-data-md text-[12px] text-on-surface-variant break-all";
        sub.textContent = detail;
        text.append(sub);
    }

    card.append(icon, text);

    // --- Kapanma ve süre ---
    let closed = false;
    let timer = null;
    let remaining = durationMs;
    let startedAt = 0;

    function close() {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        card.style.opacity = "0";
        card.style.transform = "translateY(8px)";
        setTimeout(() => card.remove(), FADE_MS);
    }

    function startTimer() {
        if (closed) return;
        startedAt = performance.now();
        timer = setTimeout(close, remaining);
    }

    function pauseTimer() {
        clearTimeout(timer);
        remaining = Math.max(500, remaining - (performance.now() - startedAt));
    }

    card.addEventListener("mouseenter", pauseTimer);
    card.addEventListener("mouseleave", startTimer);

    // --- Butonlar ---
    if (actions.length > 0) {
        const row = document.createElement("div");
        row.className = "flex justify-end gap-2 mt-2";
        for (const action of actions) {
            const btn = actionButton(action);
            btn.addEventListener("click", () => {
                close();
                action.onClick?.();
            });
            row.append(btn);
        }
        text.append(row);
    }

    getContainer().append(card);

    // Bir sonraki karede görünür hale getir (geçiş animasyonu çalışsın)
    requestAnimationFrame(() => {
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
    });

    startTimer();
    return { close };
}

// Bir sonraki açılan sayfada gösterilecek bildirimi bırak
export function queueToast(message, options = {}) {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, options }));
}

// Bırakılmış bildirim varsa göster ve sil (sayfa yenilenince tekrar çıkmaz)
export function showQueuedToast() {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return;

    sessionStorage.removeItem(FLASH_KEY);
    try {
        const { message, options } = JSON.parse(raw);
        if (typeof message === "string") showToast(message, options);
    } catch {
        // Bozuk not: sessizce geç
    }
}