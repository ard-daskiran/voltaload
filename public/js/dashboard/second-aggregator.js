// Per-second aggregation: collects 0.2 s windows and calls onSecond when a second is complete.
// 0 · 0.2 · 0.4 · 0.6 · 0.8 → second 1 (between 0–1)

import { DEFAULT_WINDOW_SECONDS, roundTime, isWholeSecond } from "../chart/chart-time.js";
import { statusCategory } from "../status/status-info.js";

function freshSecond(start) {
    return {
        start,
        total: 0,
        success: 0,
        errors: 0,
        latencySum: 0,
        latencyCount: 0,
        max: null,
        statusCounts: {},
        targetSum: 0, // Sum of the windows' target RPS (their average is the second's target)
        windowCount: 0,
    };
}

// onSecond(endSecond, second): the number of the finished second (1, 2, 3...) and its totals
export function createSecondAggregator({ onSecond }) {
    let current = freshSecond(0);
    let lastTarget = 0;

    function finalize(s) {
        const errorCodes = Object.keys(s.statusCounts).filter((code) => statusCategory(code) === "serverError");

        // If no windows arrived the target hasn't changed; use the previous one
        const target = s.windowCount > 0 ? Math.round(s.targetSum / s.windowCount) : lastTarget;
        lastTarget = target;

        onSecond(s.start + 1, { ...s, errorCodes, target });
    }

    // x: the window's start time on the chart
    function add(x, d) {
        const width = d.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
        const start = Math.floor(x + 1e-6);

        // Don't skip seconds that got no windows: close them with 0 requests
        while (current.start < start) {
            finalize(current);
            current = freshSecond(current.start + 1);
        }

        const s = current;
        s.total += d.requestCount;
        s.success += d.successCount ?? 0;
        s.errors += d.errorCount;
        s.targetSum += d.targetRps ?? 0;
        s.windowCount++;
        if (d.latencyCount > 0) {
            s.latencySum += d.avgResponseTime * d.latencyCount;
            s.latencyCount += d.latencyCount;
            s.max = s.max === null ? d.maxResponseTime : Math.max(s.max, d.maxResponseTime);
        }
        for (const [code, count] of Object.entries(d.statusCounts)) {
            s.statusCounts[code] = (s.statusCounts[code] || 0) + count;
        }

        // If the window ends on a whole second (0.8 + 0.2 = 1.0) the second is complete
        if (isWholeSecond(roundTime(x + width))) {
            finalize(current);
            current = freshSecond(start + 1);
        }
    }

    // When the test ends, close any partial second too (last responses that arrived after the time was up)
    function flush() {
        if (current.total > 0) {
            finalize(current);
            current = freshSecond(current.start + 1);
        }
    }

    function reset() {
        current = freshSecond(0);
        lastTarget = 0;
    }

    return { add, flush, reset };
}