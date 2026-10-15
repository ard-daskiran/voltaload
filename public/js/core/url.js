// url.js
// Small helpers for addresses (UI).

// If the address doesn't start with a protocol ("http://", "https://"), prepends "http://", like a browser's address bar.
//   "localhost:3000/api"      → "http://localhost:3000/api"
//   "https://localhost:3000"  → unchanged
//   ""                        → unchanged (let validation report the empty-address error)
export function withDefaultScheme(url) {
    const trimmed = url.trim();
    // Only check for a protocol at the START (so query strings like "…?next=http://…" don't mislead)
    if (!trimmed || /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
}

// Short form for display: the leading "http://" or "https://" is dropped
export function shortUrl(url) {
    return url.replace(/^https?:\/\//, "");
}