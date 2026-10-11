// Sayfa öğeleriyle çalışmak için küçük yardımcılar.

// Kimliğe göre öğe bul
export function $(id) {
    return document.getElementById(id);
}

// Metni ve sınıfı verilmiş bir <span> oluştur.
// textContent kullanır: metin HTML olarak yorumlanmaz, içine kod yazılsa bile çalışmaz.
export function createSpan(text, className = "") {
    const el = document.createElement("span");
    el.className = className;
    el.textContent = text;
    return el;
}