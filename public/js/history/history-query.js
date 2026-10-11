// Listenin durumu (sayfa, filtre, arama, sıralama) sayfanın adresinde tutulur:
//   /history.html?page=2&method=GET&search=products&sort=oldest
// Böylece detay sayfasından geri dönünce aynı yere dönülür.

const METHODS = ["GET", "POST"];

function toPositiveInt(value, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 ? n : fallback;
}

export function readQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
        page: toPositiveInt(params.get("page"), 1),
        method: METHODS.includes(params.get("method")) ? params.get("method") : "ALL",
        search: params.get("search") ?? "",
        sort: params.get("sort") === "oldest" ? "oldest" : "newest",
    };
}

// Sadece varsayılandan farklı değerleri yaz, adres sade kalsın
function toParams(state) {
    const params = new URLSearchParams();
    if (state.page > 1) params.set("page", String(state.page));
    if (state.method !== "ALL") params.set("method", state.method);
    if (state.search) params.set("search", state.search);
    if (state.sort !== "newest") params.set("sort", state.sort);
    return params;
}

// Adresi güncelle. replaceState: her harf ya da sayfa değişimi tarayıcı geçmişine ayrı kayıt olarak eklenmez.
export function writeQuery(state) {
    const query = toParams(state).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

// Sunucuya gidecek parametreler
export function toApiParams(state, pageSize) {
    const params = toParams(state);
    params.set("page", String(state.page));
    params.set("pageSize", String(pageSize));
    return params.toString();
}