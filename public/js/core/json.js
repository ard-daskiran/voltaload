// json.js
// Pretty-prints (indents) JSON text. Returns it unchanged if it's not valid JSON.
// Used by the detail page, the report and the form (rerun, reconnect).
export function prettyJson(text) {
    if (!text) return text ?? "";
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}