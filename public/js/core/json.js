// json.js
// JSON metnini okunaklı (girintili) yazar. Geçerli JSON değilse olduğu gibi döner.
// Detay sayfası, rapor ve form (yeniden çalıştırma, yeniden bağlanma) kullanır.
export function prettyJson(text) {
    if (!text) return text ?? "";
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}