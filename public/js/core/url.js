// url.js
// Adres bir protokolle ("http://", "https://") başlamıyorsa başına "http://" ekler, tarayıcı adres çubuğu gibi.
//   "localhost:3000/api"      → "http://localhost:3000/api"
//   "https://localhost:3000"  → değişmez
//   ""                        → değişmez (boş adresin hatasını doğrulama versin)
export function withDefaultScheme(url) {
    const trimmed = url.trim();
    if (!trimmed || trimmed.includes("://")) return trimmed;
    return `http://${trimmed}`;
}