// textarea-keys.js
// Code editor keys for a textarea (the form's JSON Body), like VS Code:
//   - Tab adds 2 spaces; with several lines selected it indents them all
//   - Shift+Tab removes up to 2 spaces from the start of the line (or of every selected line)
//   - Enter starts the new line with the current line's indentation
//   - After Esc, the next Tab moves the focus as usual, so a keyboard user isn't trapped in the box
// Edits go through execCommand("insertText"): Ctrl+Z / Ctrl+Y keep working, and an "input" event fires as with typing.

const INDENT = "  ";

function lineStart(text, index) {
    return text.lastIndexOf("\n", index - 1) + 1;
}

// Replaces start..end with text, keeping the browser's undo history
function replaceRange(textarea, start, end, text) {
    textarea.setSelectionRange(start, end);
    const done = text === "" ? document.execCommand("delete") : document.execCommand("insertText", false, text);
    // Fallback if the command isn't supported: the edit works, only undo doesn't cover it
    if (!done) {
        textarea.setRangeText(text, start, end, "end");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
}

// The whole lines the selection touches: from the start of the first line to the end of the last one.
// A selection ending at the very start of a line doesn't include that line (same as VS Code).
function selectedLines(textarea) {
    const text = textarea.value;
    const { selectionStart, selectionEnd } = textarea;
    const lastIndex = selectionEnd > selectionStart && text[selectionEnd - 1] === "\n" ? selectionEnd - 1 : selectionEnd;
    const start = lineStart(text, selectionStart);
    const newline = text.indexOf("\n", lastIndex);
    const end = newline === -1 ? text.length : newline;
    return { start, end, lines: text.slice(start, end).split("\n") };
}

function indent(textarea) {
    const { selectionStart, selectionEnd, value } = textarea;
    // Cursor or a selection inside one line: 2 spaces in place of it
    if (!value.slice(selectionStart, selectionEnd).includes("\n")) {
        replaceRange(textarea, selectionStart, selectionEnd, INDENT);
        return;
    }
    const block = selectedLines(textarea);
    replaceRange(textarea, block.start, block.end, block.lines.map((line) => INDENT + line).join("\n"));
    textarea.setSelectionRange(selectionStart + INDENT.length, selectionEnd + INDENT.length * block.lines.length);
}

function outdent(textarea) {
    const { selectionStart, selectionEnd } = textarea;
    const block = selectedLines(textarea);
    // How many spaces come off each line (at most 2, or one tab)
    const removed = block.lines.map((line) => (line.startsWith("\t") ? 1 : line.match(/^ {0,2}/)[0].length));
    const total = removed.reduce((sum, n) => sum + n, 0);
    if (total === 0) return;

    replaceRange(textarea, block.start, block.end, block.lines.map((line, i) => line.slice(removed[i])).join("\n"));
    // The selection moves left with the text, but not past the start of its line
    const start = Math.max(block.start, selectionStart - Math.min(removed[0], selectionStart - block.start));
    textarea.setSelectionRange(start, Math.max(start, selectionEnd - total));
}

function newLine(textarea) {
    const { selectionStart, selectionEnd, value } = textarea;
    const start = lineStart(value, selectionStart);
    // The line's leading spaces, but only up to the cursor (Enter inside the indentation keeps what's before it)
    const leading = value.slice(start, selectionStart).match(/^[ \t]*/)[0];
    replaceRange(textarea, selectionStart, selectionEnd, `\n${leading}`);
}

export function attachEditorKeys(textarea) {
    // Set by Esc: the next Tab is left to the browser (focus moves on)
    let tabLeavesBox = false;

    textarea.addEventListener("keydown", (e) => {
        // Shift alone doesn't count as a key press: Esc, then Shift+Tab still leaves the box
        if (e.isComposing || e.ctrlKey || e.altKey || e.metaKey || e.key === "Shift") return;

        if (e.key === "Escape") {
            tabLeavesBox = true;
            return;
        }
        if (e.key === "Tab") {
            if (tabLeavesBox) {
                tabLeavesBox = false;
                return;
            }
            e.preventDefault();
            if (e.shiftKey) outdent(textarea);
            else indent(textarea);
            return;
        }

        tabLeavesBox = false;
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            newLine(textarea);
        }
    });

    textarea.addEventListener("blur", () => {
        tabLeavesBox = false;
    });
}
