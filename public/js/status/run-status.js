// Testin durumu (Tamamlandı, Durduruldu...) için renk ve ad.
// Bu, sunucunun sağlığı değil testin kendi durumu: hata dolu bir test de sonuna kadar çalıştıysa "Tamamlandı" olur.

import { t } from "../core/i18n.js";

const STYLES = {
    RUNNING: { dot: "bg-primary-container animate-pulse shadow-[0_0_6px_#f4c21a]", text: "text-primary-container" },
    COMPLETED: { dot: "bg-secondary shadow-[0_0_6px_#64d8d7]", text: "text-secondary" },
    STOPPED: { dot: "bg-primary-container", text: "text-primary-container" },
    FAILED: { dot: "bg-signal-error shadow-[0_0_6px_#ff5555]", text: "text-signal-error" },
    INTERRUPTED: { dot: "bg-signal-error", text: "text-signal-error" },
};

export function runStatusStyle(status) {
    return STYLES[status] ?? STYLES.FAILED;
}

export function runStatusLabel(status) {
    return t(`runStatus.${status}`);
}