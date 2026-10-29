// collapsible.js
// A section that opens and closes with a short height animation (JSON Body and Headers in the form).
//   toggle: the button on top. An element inside it marked data-chevron turns when the section opens.
//   panel:  a grid with a single child that has overflow-hidden; its height animates between 0 and the content.
// While closed the content is inert: it can't be reached with Tab or clicked by accident.

export function createCollapsible(toggle, panel) {
    const chevron = toggle.querySelector("[data-chevron]");
    let open = false;

    function set(value) {
        open = value;
        panel.style.gridTemplateRows = open ? "1fr" : "0fr";
        panel.inert = !open;
        toggle.setAttribute("aria-expanded", String(open));
        if (chevron) chevron.style.transform = open ? "rotate(90deg)" : "";
    }

    toggle.addEventListener("click", () => set(!open));
    set(false);

    return {
        open: () => set(true),
        close: () => set(false),
        isOpen: () => open,
    };
}