// Listeden bir teste girerken listenin hangi halde olduğunu (sayfa, filtre, arama) not eder.
// Detay sayfasındaki "← Geçmiş" bu notla kaldığın yere döner ve tıkladığın test vurgulanır.
// sessionStorage: sekmeye özel, sekme kapanınca silinir.

const STORAGE_KEY = "volta-history-return";
const FALLBACK_URL = "/history.html";

// Liste sayfası çağırır, teste gitmeden hemen önce
export function rememberListPosition(testRunId) {
    sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ url: window.location.pathname + window.location.search, testRunId })
    );
}

// Detay sayfası çağırır: not bu test içinse listenin o haline, değilse düz listeye dön.
// Dönüş adresine "focus" eklenir, liste o satıra kaydırıp vurgular.
export function getReturnUrl(testRunId) {
    try {
        const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
        if (saved && saved.testRunId === testRunId && typeof saved.url === "string" && saved.url.startsWith(FALLBACK_URL)) {
            const separator = saved.url.includes("?") ? "&" : "?";
            return `${saved.url}${separator}focus=${encodeURIComponent(testRunId)}`;
        }
    } catch {
        // Not bozuksa düz listeye dön
    }
    return FALLBACK_URL;
}