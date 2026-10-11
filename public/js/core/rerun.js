// "Yeniden çalıştır" ve önerilerdeki "Bu testi çalıştır" için:
// ayarlar bir sayfada bırakılır, anasayfadaki form bir kez okuyup siler.

const RERUN_STORAGE_KEY = "volta-rerun";

// Ayarları bırak, anasayfaya git (form bu ayarlarla dolar)
// settings: { url, method, body, targetRps, duration, loadProfile, stepCount }
export function rerunWith(settings) {
    sessionStorage.setItem(RERUN_STORAGE_KEY, JSON.stringify(settings));
    window.location.href = "/";
}

// Bırakılan ayarları al ve sil (bir kez kullanılsın, sayfa yenilenince form tekrar dolmasın).
// Ayar yoksa ya da okunamıyorsa null döner.
export function takeRerunSettings() {
    const raw = sessionStorage.getItem(RERUN_STORAGE_KEY);
    if (!raw) return null;

    sessionStorage.removeItem(RERUN_STORAGE_KEY);

    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error("Yeniden çalıştırma ayarları okunamadı:", err);
        return null;
    }
}