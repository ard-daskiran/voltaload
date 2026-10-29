// headers.js
// Custom request headers: rules shared by the form, the detail page and the report.
// The server checks the same rules again (src/services/startRequest.ts); if one changes, change the other too.

import { t, formatNumber } from "./i18n.js";
import { LIMITS } from "./limits.js";

// Managed by Volta and undici; the server rejects them
export const FORBIDDEN_HEADERS = new Set([
    "host",
    "content-length",
    "transfer-encoding",
    "connection",
    "keep-alive",
    "upgrade",
    "te",
    "trailer",
    "expect",
]);

// Header name: English letters, digits and a few symbols, no spaces
const NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
// Header value: printable English characters, spaces and tabs (no "ş", "ğ" or line breaks)
const VALUE_PATTERN = /^[\t\x20-\x7e]*$/;

// Headers whose value is hidden by default: tokens, cookies, keys
const SENSITIVE_NAMES = new Set(["authorization", "proxy-authorization", "cookie"]);
const SENSITIVE_PARTS = ["token", "key", "secret", "password"];

export function isSensitiveHeader(name) {
    const key = name.trim().toLowerCase();
    return SENSITIVE_NAMES.has(key) || SENSITIVE_PARTS.some((part) => key.includes(part));
}

// How a hidden value is shown: "Bearer eyJhbGciOi...Oi3x" → "Bearer ••••••Oi3x".
// The scheme word (Bearer, Basic...) stays visible; of the secret only the last 4 characters, and only if it's long
// enough that 4 characters don't give it away.
export function maskHeaderValue(value) {
    const match = value.match(/^([A-Za-z]{2,10} )(\S.*)$/);
    const prefix = match ? match[1] : "";
    const secret = match ? match[2] : value;
    const tail = secret.length > 8 ? secret.slice(-4) : "";
    return `${prefix}••••••${tail}`;
}

// The value as shown on the detail page and in the report
export function displayHeaderValue(header) {
    return header.masked ? maskHeaderValue(header.value) : header.value;
}

// Checks the headers the way the server will (names and values already trimmed).
// Returns an error text, or null if they're valid.
export function checkHeaders(headers) {
    if (headers.length > LIMITS.maxHeaders) {
        return t("error.TOO_MANY_HEADERS", { max: LIMITS.maxHeaders });
    }

    const seen = new Set();
    let bytes = 0;

    for (const { name, value } of headers) {
        if (name === "") return t("form.headers.nameMissing");
        if (!NAME_PATTERN.test(name)) return t("error.HEADER_NAME_INVALID", { name });

        const key = name.toLowerCase();
        if (FORBIDDEN_HEADERS.has(key)) return t("error.HEADER_FORBIDDEN", { name });
        if (seen.has(key)) return t("error.HEADER_DUPLICATE", { name });
        if (!VALUE_PATTERN.test(value)) return t("error.HEADER_VALUE_INVALID", { name });

        seen.add(key);
        bytes += name.length + value.length + 4; // "name: value\r\n"
    }

    if (bytes > LIMITS.maxHeaderBytes) {
        return t("error.HEADERS_TOO_LARGE", { max: formatNumber(LIMITS.maxHeaderBytes) });
    }
    return null;
}

// Pasted text → headers, one per line: "Name: value".
// Also accepts lines copied from curl (-H "Name: value" \) and the browser's developer tools.
// Lines starting with ":" (HTTP/2 entries like ":authority") aren't real headers and are skipped.
export function parseHeaderLines(text) {
    return text
        .split(/\r?\n/)
        .map((line) =>
            line
                .trim()
                .replace(/\\$/, "") // curl's line continuation
                .trim()
                .replace(/^(-H|--header)\s+/, "")
                .replace(/^(["'])(.*)\1$/, "$2")
                .trim()
        )
        .filter((line) => line !== "" && !line.startsWith(":"))
        .map((line) => {
            const colon = line.indexOf(":");
            return colon === -1
                ? { name: line, value: "" }
                : { name: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() };
        });
}