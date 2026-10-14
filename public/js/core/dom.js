// Sayfa öğeleriyle çalışmak için küçük yardımcılar.

// Kimliğe göre öğe bul
export function $(id) {
    return document.getElementById(id);
}

// Sınıfı ve (isteğe bağlı) metni verilmiş bir öğe oluştur: el("div", "flex gap-2", "Merhaba")
// textContent kullanır: metin HTML olarak yorumlanmaz, içine kod yazılsa bile çalışmaz.
export function el(tag, className = "", text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Metni ve sınıfı verilmiş bir <span>
export function createSpan(text, className = "") {
    return el("span", className, text);
}