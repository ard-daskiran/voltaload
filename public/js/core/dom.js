// Small helpers for working with page elements.

// Find an element by ID
export function $(id) {
    return document.getElementById(id);
}

// Create an element with the given class and (optional) text: el("div", "flex gap-2", "Hello")
// Uses textContent: the text isn't parsed as HTML, so even code written into it won't run.
export function el(tag, className = "", text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// A <span> with the given text and class
export function createSpan(text, className = "") {
    return el("span", className, text);
}