// Information about status codes: description, short name, category and color.
// Used by the home page, the detail page and the report.

import { t } from "../core/i18n.js";

// Error types used for requests with no response
const ERROR_TYPES = ["TIMEOUT", "CONNECTION_REFUSED", "CONNECTION_RESET", "NETWORK_ERROR"];

// HTTP's standard code names (the same in every language)
const HTTP_REASONS = {
    200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
    301: "Moved Permanently", 302: "Found", 304: "Not Modified",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
    405: "Method Not Allowed", 408: "Request Timeout", 409: "Conflict",
    422: "Unprocessable Content", 429: "Too Many Requests",
    500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
};

function isErrorType(code) {
    return ERROR_TYPES.includes(String(code));
}

// Category: also decides whether it turns the chart red (only serverError does)
export function statusCategory(code) {
    const numeric = Number(code);
    if (isErrorType(code) || numeric >= 500) return "serverError";
    if (numeric >= 400) return "clientError";
    if (numeric >= 300) return "redirect";
    return "success";
}

// The code's description: first the code's own text, otherwise its group's general text
export function statusDescription(code) {
    const key = `status.${code}`;
    const specific = t(key);
    if (specific !== key) return specific;

    const numeric = Number(code);
    if (numeric >= 200 && numeric < 300) return t("status.group.2xx");
    if (numeric >= 300 && numeric < 400) return t("status.group.3xx");
    if (numeric >= 400 && numeric < 500) return t("status.group.4xx");
    if (numeric >= 500 && numeric < 600) return t("status.group.5xx");
    return t("status.unknown");
}

// Short name: the standard name for HTTP codes, the dictionary name for error types
export function statusName(code) {
    if (isErrorType(code)) return t(`status.name.${code}`);
    return HTTP_REASONS[code] ?? "";
}

export function statusStyle(code) {
    switch (statusCategory(code)) {
        case "serverError":
            return { dot: "bg-signal-error", text: "text-signal-error", bar: "bg-signal-error" };
        case "clientError":
            return { dot: "bg-primary-container", text: "text-primary-container", bar: "bg-primary-container" };
        case "redirect":
            return { dot: "bg-tertiary", text: "text-tertiary", bar: "bg-tertiary" };
        default:
            return { dot: "bg-secondary", text: "text-secondary", bar: "bg-secondary" };
    }
}

// Sorting: numeric codes first in ascending order, then error types
export function sortStatusCodes(codes) {
    return [...codes].sort((a, b) => {
        const aErr = isErrorType(a);
        const bErr = isErrorType(b);
        if (aErr !== bErr) return aErr ? 1 : -1;
        if (aErr) return a.localeCompare(b);
        return Number(a) - Number(b);
    });
}