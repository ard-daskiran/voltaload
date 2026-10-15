// The list's state (page, filter, search, sort) is kept in the page's URL:
//   /history.html?page=2&method=GET&search=products&sort=oldest
// This way coming back from the detail page returns to the same place.

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

// Write only values that differ from the default, so the URL stays clean
function toParams(state) {
    const params = new URLSearchParams();
    if (state.page > 1) params.set("page", String(state.page));
    if (state.method !== "ALL") params.set("method", state.method);
    if (state.search) params.set("search", state.search);
    if (state.sort !== "newest") params.set("sort", state.sort);
    return params;
}

// Update the URL. replaceState: each keystroke or page change isn't added as a separate browser history entry.
export function writeQuery(state) {
    const query = toParams(state).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

// Parameters to send to the server
export function toApiParams(state, pageSize) {
    const params = toParams(state);
    params.set("page", String(state.page));
    params.set("pageSize", String(pageSize));
    return params.toString();
}