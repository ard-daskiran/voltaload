// json-highlight.js
// Colors JSON text: field names, text values, {{variables}}, numbers / true / false / null and { } [ ] , :
// A small tokenizer, not a parser: it never throws, and whatever it doesn't recognize (invalid JSON) stays plain.
// Used by the form's JSON Body (a colored layer behind the textarea), the "Random user" preview and the detail page.

// Colors from the theme (tailwind-config.js). Only colors: no padding or weight, so the layer lines up with the textarea.
const CLASSES = {
    key: "text-on-surface",
    string: "text-secondary",
    variable: "text-primary-container bg-primary-container/15 rounded-sm",
    literal: "text-error",
    punctuation: "text-outline",
};

// Same pattern as the variables (core/variables.js): {{name}}, spaces inside the braces allowed
const VARIABLE_PATTERN = /\{\{\s*[^{}\s]*\s*\}\}/y;
const VARIABLE_PATTERN_ALL = /\{\{\s*[^{}\s]*\s*\}\}/g;
const NUMBER_PATTERN = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const LITERAL_PATTERN = /(?:true|false|null)\b/y;
const PUNCTUATION = new Set(["{", "}", "[", "]", ",", ":"]);
const WHITESPACE = new Set([" ", "\t", "\r", "\n"]);

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function span(kind, text) {
    return `<span class="${CLASSES[kind]}">${escapeHtml(text)}</span>`;
}

// A string (with its quotes): the {{variables}} inside get their own color
function stringHtml(text, kind) {
    let html = "";
    let last = 0;
    for (const match of text.matchAll(VARIABLE_PATTERN_ALL)) {
        if (match.index > last) html += span(kind, text.slice(last, match.index));
        html += span("variable", match[0]);
        last = match.index + match[0].length;
    }
    if (last < text.length) html += span(kind, text.slice(last));
    return html;
}

// Tries a sticky pattern at position i; returns the matched text or null
function matchAt(pattern, text, i) {
    pattern.lastIndex = i;
    const match = pattern.exec(text);
    return match ? match[0] : null;
}

// The text as HTML with colored spans. Everything is escaped, so it's safe to put into innerHTML.
export function highlightJson(text) {
    let html = "";
    let plainStart = 0; // Start of the plain (uncolored) text not yet written
    let i = 0;

    function emit(end, piece) {
        if (i > plainStart) html += escapeHtml(text.slice(plainStart, i));
        html += piece;
        i = end;
        plainStart = end;
    }

    while (i < text.length) {
        const char = text[i];

        if (char === '"') {
            // Up to the closing quote; an unclosed string ends at the line's end
            let j = i + 1;
            while (j < text.length && text[j] !== '"' && text[j] !== "\n") {
                if (text[j] === "\\" && text[j + 1] !== "\n") j++;
                j++;
            }
            const end = text[j] === '"' ? j + 1 : Math.min(j, text.length);
            // A field name if a ":" follows it
            let k = end;
            while (WHITESPACE.has(text[k])) k++;
            emit(end, stringHtml(text.slice(i, end), text[k] === ":" ? "key" : "string"));
            continue;
        }

        if (char === "{" && text[i + 1] === "{") {
            const variable = matchAt(VARIABLE_PATTERN, text, i);
            if (variable) {
                emit(i + variable.length, span("variable", variable));
                continue;
            }
        }

        if (PUNCTUATION.has(char)) {
            emit(i + 1, span("punctuation", char));
            continue;
        }

        if (char === "-" || (char >= "0" && char <= "9")) {
            const number = matchAt(NUMBER_PATTERN, text, i);
            if (number) {
                emit(i + number.length, span("literal", number));
                continue;
            }
        }

        if (char === "t" || char === "f" || char === "n") {
            const literal = matchAt(LITERAL_PATTERN, text, i);
            if (literal) {
                emit(i + literal.length, span("literal", literal));
                continue;
            }
        }

        i++;
    }

    if (text.length > plainStart) html += escapeHtml(text.slice(plainStart));
    return html;
}

// Shows the text colored in an element (a <pre>)
export function renderJson(element, text) {
    element.innerHTML = highlightJson(text);
}

// Above this size coloring on every key press could lag: while typing, the plain text shows, colored a moment later
const LARGE_TEXT_LENGTH = 20000;
const LARGE_TEXT_DELAY_MS = 200;

// The colored layer behind a textarea. The textarea's text is transparent (the caret and the selection still show),
// the layer below shows the same text colored. Both must have the same font, size, line height, padding and border.
//   refresh(): call after the value changes (typing is handled here; call it when the value is set from code)
export function createJsonOverlay({ textarea, layer }) {
    let timer = null;

    function syncScroll() {
        layer.scrollTop = textarea.scrollTop;
        layer.scrollLeft = textarea.scrollLeft;
    }

    // A pre doesn't show an empty last line, a textarea does: a space keeps them the same height
    function render() {
        const text = textarea.value;
        layer.innerHTML = highlightJson(text.endsWith("\n") ? `${text} ` : text);
        setPlain(false);
        syncScroll();
    }

    // Plain mode: the textarea shows its own text and the layer is hidden (for a large text, until it's colored)
    function setPlain(plain) {
        textarea.classList.toggle("text-transparent", !plain);
        textarea.classList.toggle("text-secondary", plain);
        layer.style.visibility = plain ? "hidden" : "";
    }

    function refresh() {
        clearTimeout(timer);
        render();
    }

    textarea.addEventListener("input", () => {
        clearTimeout(timer);
        if (textarea.value.length <= LARGE_TEXT_LENGTH) {
            render();
            return;
        }
        setPlain(true);
        timer = setTimeout(render, LARGE_TEXT_DELAY_MS);
    });
    textarea.addEventListener("scroll", syncScroll);

    render();
    return { refresh, syncScroll };
}
