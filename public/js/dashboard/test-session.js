// Test session: start/stop requests to the server, the Socket.io live stream and reconnecting after a page reload.
// The Socket.io library is loaded in index.html as a regular script (global "io").

import { apiErrorMessage } from "../core/api-error.js";

// onConnectionLost(testRunning) / onConnectionRestored(): the live connection to Volta was lost / established
export function createTestSession({ onWindow, onDone, onError, onConnectionLost, onConnectionRestored }) {
    const socket = io();

    let activeTestRunId = null;
    let backfilling = false; // While reconnecting, hold live batches until past windows are processed
    let pendingWindows = [];
    let lastElapsed = 0; // Prevents the same window from being processed twice when reconnecting

    function dispatch(d) {
        lastElapsed = Math.max(lastElapsed, d.elapsedSeconds);
        onWindow(d);
    }

    function join(testRunId) {
        activeTestRunId = testRunId;
        lastElapsed = 0;
        socket.emit("join-test", testRunId);
    }

    // --- Socket.io ---

    socket.on("progress", (d) => {
        if (!activeTestRunId) return;
        if (backfilling) {
            pendingWindows.push(d);
            return;
        }
        dispatch(d);
    });

    socket.on("done", (data) => {
        if (!activeTestRunId) return;
        activeTestRunId = null;
        onDone(data?.status);
    });

    socket.on("error", (data) => {
        if (!activeTestRunId) return;
        activeTestRunId = null;
        onError(apiErrorMessage(data, "error.TEST_UNEXPECTED_ERROR"));
    });

    // If the connection drops briefly Socket.io reconnects by itself; join the room again
    socket.on("connect", () => {
        if (activeTestRunId) socket.emit("join-test", activeTestRunId);
        onConnectionRestored?.();
    });

    // Volta shut down or the connection was lost (Socket.io keeps trying to reconnect in the background)
    socket.on("disconnect", () => {
        onConnectionLost?.(Boolean(activeTestRunId));
    });

    // --- Public functions ---

    // Starts the test. On success { ok: true, testRunId }, otherwise { ok: false, error } or { ok: false, unreachable: true }
    async function start(payload) {
        let response;
        try {
            response = await fetch("/api/test-run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            // The request never went out: Volta is down
            console.error(err);
            return { ok: false, unreachable: true };
        }

        // If a response arrived but isn't JSON (not expected), that's "couldn't start", not "unreachable"
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.testRunId) {
            return { ok: false, error: apiErrorMessage(data, "error.START_FAILED") };
        }
        return { ok: true, testRunId: data.testRunId };
    }

    // Start listening to the started test's live stream (called after the screen is prepared)
    function follow(testRunId) {
        join(testRunId);
    }

    // Stop request. The UI unlocks on the "done" message from the server.
    async function stop() {
        if (!activeTestRunId) return { ok: true };
        try {
            await fetch(`/api/test-run/${activeTestRunId}/stop`, { method: "POST" });
            return { ok: true };
        } catch (err) {
            console.error(err);
            return { ok: false };
        }
    }

    // When the page opens, reconnect to a running test if there is one.
    // onActive(active): called to prepare the screen, before the windows are processed.
    // Returns: "none" (no running test), "resumed" (reconnected), "finished" (ended in the meantime)
    async function resume(onActive) {
        let active = null;

        try {
            const response = await fetch("/api/test-run/active");
            ({ active } = await response.json());
        } catch {
            return "none";
        }

        if (!active) return "none";

        onActive(active);

        // First join the room and hold live batches, then process the windows so far, and finally the held ones
        backfilling = true;
        pendingWindows = [];
        join(active.testRunId);

        try {
            const response = await fetch(`/api/test-run/${active.testRunId}/live`);
            const { windows } = await response.json();
            for (const w of windows) dispatch(w);
        } catch (err) {
            console.error("Could not fetch past windows:", err);
        } finally {
            backfilling = false;
            // Skip live batches already covered by the backfill
            const cutoff = lastElapsed;
            for (const w of pendingWindows) {
                if (w.elapsedSeconds > cutoff) dispatch(w);
            }
            pendingWindows = [];
        }

        // If the test ended in the meantime the "done" message may have been missed; check
        try {
            const response = await fetch("/api/test-run/active");
            const { active: stillActive } = await response.json();
            if (!stillActive || stillActive.testRunId !== active.testRunId) {
                activeTestRunId = null;
                return "finished";
            }
        } catch {
            // If the server couldn't be reached, the live stream will report the state anyway
        }

        return "resumed";
    }

    return { start, follow, stop, resume };
}