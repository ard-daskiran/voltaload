// connection-overlay.js
// "Lost connection to Volta" box (home page). Since the page keeps running in the browser,
// it can be shown even while Volta is down; the texts are in the dictionary, already loaded.
//   - When the connection drops it waits a bit and opens if still disconnected (so short drops don't make the screen flicker)
//   - When Volta comes back: closes by itself if no test was running, asks for a reload if one was
//   - The "Reload page" button stays disabled until Volta is back (reloading while it's down shows "site can't be reached")

import { t } from "./i18n.js";
import { el } from "./dom.js";

const SHOW_DELAY_MS = 1500;
const DOTS_INTERVAL_MS = 400; // Speed of the "..." animation
const DOT_FRAMES = [".", "..", "..."];


export function createConnectionOverlay() {
    let overlay = null;
    let refs = null;
    let timer = null;
    let dotsTimer = null;
    let needsReload = false; // A test was running when it disconnected: the data on screen is no longer reliable
    let previousOverflow = "";

    function build() {
        // The background isn't darkened, it's blurred
        const root = el("div", "fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/20 backdrop-blur-md");

        const box = el("div", "relative w-full max-w-md bg-surface-container-lowest border border-border-subtle rounded-lg shadow-2xl flex flex-col overflow-hidden");
        box.setAttribute("role", "alertdialog");
        box.setAttribute("aria-modal", "true");

        const bar = el("div", "absolute top-0 left-0 w-full h-1 bg-signal-error");

        const body = el("div", "p-6 flex flex-col gap-4");
        const heading = el("div", "flex items-center gap-2");
        heading.append(
            el("span", "material-symbols-outlined text-signal-error text-[22px]", "link_off"),
            el("h2", "font-headline-md text-headline-md text-on-surface", t("connection.lostTitle"))
        );
        const message = el("p", "font-body-md text-body-md text-on-surface-variant", t("connection.lostText"));

        const statusRow = el("div", "flex items-center gap-2 font-data-md text-[13px] text-on-surface-variant");
        const dot = el("span", "w-2 h-2 rounded-full bg-primary-container animate-pulse");
        const statusText = el("span", "", t("connection.reconnecting"));
        // Fixed width: so the line doesn't shift when the number of dots changes
        const dots = el("span", "inline-block w-[3ch] text-left", DOT_FRAMES[0]);
        const textWrap = el("span", "");
        textWrap.append(statusText, dots);
        statusRow.append(dot, textWrap);

        body.append(heading, message, statusRow);

        const footer = el("div", "px-6 py-4 border-t border-border-subtle bg-surface-container-low/70 flex justify-end");
        const reloadBtn = el(
            "button",
            "px-4 py-2 bg-primary-container text-[#000000] font-label-caps text-label-caps font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed",
            t("connection.reload")
        );
        reloadBtn.type = "button";
        reloadBtn.disabled = true;
        reloadBtn.addEventListener("click", () => location.reload());
        footer.append(reloadBtn);

        box.append(bar, body, footer);
        root.append(box);

        refs = { message, dot, statusText, dots, reloadBtn };
        return root;
    }

    // "." → ".." → "..." → "." (while trying to reconnect)
    function startDots() {
        let frame = 0;
        dotsTimer = setInterval(() => {
            frame = (frame + 1) % DOT_FRAMES.length;
            if (refs) refs.dots.textContent = DOT_FRAMES[frame];
        }, DOTS_INTERVAL_MS);
    }

    function stopDots() {
        clearInterval(dotsTimer);
        dotsTimer = null;
    }

    function show() {
        timer = null;
        if (overlay) return;
        overlay = build();
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.body.append(overlay);
        startDots();
    }

    function hide() {
        if (!overlay) return;
        stopDots();
        overlay.remove();
        overlay = null;
        refs = null;
        document.body.style.overflow = previousOverflow;
    }

    // Connection lost. testRunning: whether a test was being watched at the time
    function lost(testRunning) {
        if (testRunning) needsReload = true;
        if (overlay || timer) return;
        timer = setTimeout(show, SHOW_DELAY_MS);
    }

    // Connection (re)established. Also called once when the page opens; does nothing then.
    function restored() {
        clearTimeout(timer);
        timer = null;
        if (!overlay) return;

        if (!needsReload) {
            hide();
            return;
        }

        // A test was running: the box stays, the dots stop, reload is enabled
        stopDots();
        refs.message.textContent = t("connection.restoredText");
        refs.statusText.textContent = t("connection.reconnected");
        refs.dots.textContent = "";
        refs.dot.className = "w-2 h-2 rounded-full bg-secondary";
        refs.reloadBtn.disabled = false;
        refs.reloadBtn.focus();
    }

    return { lost, restored };
}