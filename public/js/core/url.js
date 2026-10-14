// url.js
// Adres bir protokolle ("http://", "https://") başlamıyorsa başına "http://" ekler, tarayıcı adres çubuğu gibi.
//   "localhost:3000/api"      → "http://localhost:3000/api"
//   "https://localhost:3000"  → değişmez
//   ""                        → değişmez (boş adresin hatasını doğrulama versin)
export function withDefaultScheme(url) {
    const trimmed = url.trim();
    // Sadece BAŞTA bir protokol var mı bak ("…?next=http://…" gibi sorgu dizeleri yanıltmasın)
    if (!trimmed || /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
}