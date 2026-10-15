// Color and name for the test's status (Completed, Stopped...).
// This is the test's own status, not the server's health: a test full of errors that ran to the end is still "Completed".

import { t } from "../core/i18n.js";

const STYLES = {
    RUNNING: { dot: "bg-primary-container animate-pulse shadow-[0_0_6px_#f4c21a]", text: "text-primary-container" },
    COMPLETED: { dot: "bg-secondary shadow-[0_0_6px_#64d8d7]", text: "text-secondary" },
    STOPPED: { dot: "bg-primary-container", text: "text-primary-container" },
    FAILED: { dot: "bg-signal-error shadow-[0_0_6px_#ff5555]", text: "text-signal-error" },
    INTERRUPTED: { dot: "bg-signal-error", text: "text-signal-error" },
};

export function runStatusStyle(status) {
    return STYLES[status] ?? STYLES.FAILED;
}

export function runStatusLabel(status) {
    return t(`runStatus.${status}`);
}