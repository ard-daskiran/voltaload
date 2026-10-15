// Turns an error from the server into text in the user's language.
// The server sends { error, code, params }: the code's text if it's in the dictionary, otherwise the server's (English) fallback text.

import { t } from "./i18n.js";

// data: the server's response body (empty object if it couldn't be read)
// fallbackKey: dictionary key to show if there's neither a code nor a fallback text
export function apiErrorMessage(data, fallbackKey) {
    if (data?.code) {
        const key = `error.${data.code}`;
        const text = t(key, data.params ?? {});
        // t() returns the key itself for a key that's not in the dictionary
        if (text !== key) return text;
    }
    return data?.error ?? t(fallbackKey);
}