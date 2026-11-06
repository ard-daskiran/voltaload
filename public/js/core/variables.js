// variables.js
// Variables in the URL, JSON body and header values: {{email}}, {{username}}, {{name}}, {{password}}, {{n}}, {{uuid}}.
// The form checks them before starting so a typo shows up right away.
// The server checks the same rules again (src/engine/variables.ts); if one changes, change the other too.

import { t } from "./i18n.js";

export const VARIABLE_NAMES = ["email", "username", "name", "password", "n", "uuid"];

// {{name}}; spaces inside the braces are allowed ({{ email }})
const VARIABLE_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g;

function findVariables(text) {
    return [...text.matchAll(VARIABLE_PATTERN)].map((match) => match[1]);
}

// Does any of the texts use a variable? (same as usesVariables on the server: then the test gets a CSV with the values)
export function usesVariables(texts) {
    return texts.some((text) => findVariables(text).length > 0);
}

// Is there a variable in the server part of the address ("http://{{n}}.localhost/...")?
function variableInHost(url) {
    const schemeEnd = url.indexOf("://");
    const start = schemeEnd === -1 ? 0 : schemeEnd + 3;
    const ends = ["/", "?", "#"].map((char) => url.indexOf(char, start)).filter((index) => index !== -1);
    const end = ends.length > 0 ? Math.min(...ends) : url.length;
    return url.slice(start, end).includes("{{");
}

// Returns an error text, or null if the variables are fine (or there are none).
// body: the text in the JSON Body box ("" if the body isn't sent)
export function checkVariables({ url, body, headers }) {
    const texts = [url, body, ...headers.map((header) => header.value)];
    for (const text of texts) {
        for (const name of findVariables(text)) {
            if (!VARIABLE_NAMES.includes(name)) return t("error.UNKNOWN_VARIABLE", { variable: name.slice(0, 50) });
        }
    }
    if (variableInHost(url)) return t("error.VARIABLE_IN_HOST");
    return null;
}