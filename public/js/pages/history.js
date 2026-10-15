// History list: search, filter, sorting and pagination. Clicking a row opens the detail page.
// When coming back from the detail page via "← History", it smoothly scrolls to the clicked test and highlights it.

import { $ } from "../core/dom.js";
import { t, formatNumber, applyTranslations } from "../core/i18n.js";
import { renderHeader } from "../core/header.js";
import { confirmDialog } from "../core/confirm-dialog.js";
import { readQuery, writeQuery, toApiParams } from "../history/history-query.js";
import { createHistoryTable } from "../history/history-table.js";
import { createPagination } from "../history/pagination.js";
import { createSortMenu } from "../history/sort-menu.js";
import { rememberListPosition } from "../history/return-to-list.js";
import { showToast, showQueuedToast } from "../core/toast.js";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300; // Search this long after typing stops
const FOCUS_HIGHLIGHT_MS = 2000; // How long the returned-to test stays highlighted
const FOCUS_SCROLL_MS = 450; // Duration of the scroll-to-row animation
const FOCUS_COLOR = "rgba(100, 216, 215, 0.15)"; // 15% of the secondary color

renderHeader();
applyTranslations();

const searchInput = $("history-search");
const methodButtons = document.querySelectorAll("[data-method]");

let state = readQuery();
let requestId = 0; // So an old response doesn't overwrite a newer one while typing fast
let searchTimer = null;

// Test to highlight if we came back from the detail page via "← History" (first load only)
let focusId = new URLSearchParams(window.location.search).get("focus");

const table = createHistoryTable($("history-body"));

const pagination = createPagination({
    rangeEl: $("history-range"),
    pagesEl: $("history-pages"),
    onChange: (page) => {
        state.page = page;
        refresh({ scrollToTop: true });
    },
});

const sortMenu = createSortMenu({
    onChange: (sort) => {
        state.sort = sort;
        state.page = 1;
        refresh();
    },
});

// Normal click opens in the same tab, Ctrl/Cmd in a new tab. Note the list's state first.
function openRun(run, event) {
    rememberListPosition(run.id);
    const url = `/test.html?id=${encodeURIComponent(run.id)}`;
    if (event.ctrlKey || event.metaKey) window.open(url, "_blank");
    else window.location.href = url;
}

// --- Scrolling to the returned-to test ---

// Wait for the browser's next paint frame
function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

// Motion that starts fast and slows down toward the end
function easeOutCubic(progress) {
    return 1 - Math.pow(1 - progress, 3);
}

// Smoothly scroll to the returned-to test's row and briefly highlight it.
// The target is recomputed every frame: even if Tailwind styles or fonts change the page height
// during the scroll, it stops right on the row.
async function focusRow(id) {
    const row = document.querySelector(`[data-run-id="${CSS.escape(id)}"]`);
    if (!row) return;

    try {
        await document.fonts.ready;
    } catch {
        // If font info isn't available, continue without waiting
    }
    await nextFrame();
    await nextFrame();

    // Highlight: a direct color (not tied to Tailwind). It fades out smoothly thanks to the row's transition-colors.
    row.style.backgroundColor = FOCUS_COLOR;
    setTimeout(() => (row.style.backgroundColor = ""), FOCUS_HIGHLIGHT_MS);

    // If the user starts scrolling themselves, abandon the animation
    const userEvents = ["wheel", "touchstart", "keydown", "mousedown"];
    let cancelled = false;

    function cancel() {
        cancelled = true;
        userEvents.forEach((name) => window.removeEventListener(name, cancel));
    }
    userEvents.forEach((name) => window.addEventListener(name, cancel, { passive: true }));

    // Scroll position that brings the row to the middle of the screen (within the page bounds)
    function targetY() {
        const rect = row.getBoundingClientRect();
        const y = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
        const maxY = document.documentElement.scrollHeight - window.innerHeight;
        return Math.max(0, Math.min(y, maxY));
    }

    const startY = window.scrollY;
    const startTime = performance.now();

    function step(now) {
        if (cancelled) return;

        const progress = Math.min(1, (now - startTime) / FOCUS_SCROLL_MS);
        window.scrollTo(0, startY + (targetY() - startY) * easeOutCubic(progress));

        if (progress < 1) requestAnimationFrame(step);
        else cancel();
    }

    requestAnimationFrame(step);
}

// --- List ---

// Set the buttons' appearance based on the state
function syncControls() {
    methodButtons.forEach((btn) => {
        const active = btn.dataset.method === state.method;
        btn.classList.toggle("bg-primary-container", active);
        btn.classList.toggle("text-on-primary-container", active);
        btn.classList.toggle("font-bold", active);
        btn.classList.toggle("text-on-surface-variant", !active);
        btn.classList.toggle("hover:text-on-surface", !active);
    });
    sortMenu.setValue(state.sort);
}

// scrollToTop: scroll to the top when the new page's data arrives (only for page buttons)
async function refresh({ scrollToTop = false } = {}) {
    writeQuery(state); // "focus" in the URL is cleared here; only known settings are written
    syncControls();

    const id = ++requestId;

    try {
        const response = await fetch(`/api/test-run?${toApiParams(state, PAGE_SIZE)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (id !== requestId) return;

        // If the page in the URL no longer exists (e.g. because of deleted tests), go to the last page
        const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
        if (data.items.length === 0 && data.total > 0 && state.page > totalPages) {
            state.page = totalPages;
            return refresh({ scrollToTop });
        }

        $("history-total-badge").textContent = t("history.countBadge", { count: formatNumber(data.total) });

        if (data.items.length === 0) {
            const filtered = state.search || state.method !== "ALL";
            table.showMessage(t(filtered ? "history.noMatch" : "history.empty"));
        } else {
            table.render(data.items, openRun);
        }

        pagination.render(data);

        if (focusId) {
            focusRow(focusId);
            focusId = null;
        } else if (scrollToTop) {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    } catch (err) {
        if (id !== requestId) return;
        console.error(err);
        table.showMessage(t("history.loadError"), true);
        pagination.render({ page: 1, pageSize: PAGE_SIZE, total: 0 });
    }
}

// --- Clearing the database ---

// Total test count regardless of filters (shown in the dialog)
async function fetchTotalCount() {
    const response = await fetch("/api/test-run?pageSize=1");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()).total;
}

async function clearDatabase() {
    let total = null;
    try {
        total = await fetchTotalCount();
    } catch (err) {
        console.error(err);
    }

    // If there are no tests to delete, just inform (no confirm button)
    if (total === 0) {
        await confirmDialog({ title: t("clearDb.title"), message: t("clearDb.empty") });
        return;
    }

    let deletedRuns = 0;

    const cleared = await confirmDialog({
        title: t("clearDb.title"),
        message: t("clearDb.message", { count: total === null ? "?" : formatNumber(total) }),
        requireText: t("clearDb.confirmText"),
        confirmLabel: t("clearDb.confirm"),
        busyLabel: t("clearDb.busy"),
        doneLabel: t("clearDb.done"),
        onConfirm: async () => {
            const response = await fetch("/api/test-run", { method: "DELETE" });
            if (response.status === 409) throw new Error(t("clearDb.running"));
            if (!response.ok) throw new Error(t("clearDb.failed"));
            ({ deletedRuns } = await response.json());
        },
    });

    if (cleared) {
        showToast(t("clearDb.toast", { count: formatNumber(deletedRuns) }), { type: "danger" });
        state.page = 1;
        refresh();
    }
}

// --- Events ---

searchInput.value = state.search;
searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        state.search = searchInput.value.trim();
        state.page = 1;
        refresh();
    }, SEARCH_DELAY_MS);
});

methodButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        if (state.method === btn.dataset.method) return;
        state.method = btn.dataset.method;
        state.page = 1;
        refresh();
    });
});

$("clear-db-btn").addEventListener("click", clearDatabase);

table.showMessage(t("history.loading"));
showQueuedToast(); // Notification for a test deleted on the detail page
refresh();