import { Worker } from "node:worker_threads";
import path from "node:path";
import type { Server } from "socket.io";
import { prisma } from "../db/prisma.js";
import { targetRpsAt, type LoadProfile } from "./scheduler.js";
import { computeTestSummary } from "./summary.js";
import { summarizeWindow } from "./windowStats.js";
import { DB_FLUSH_INTERVAL_MS, LIVE_WINDOW_MS, LIVE_EMIT_DELAY_MS, WORKER_LAG_WARNING_MS } from "../config.js";
import { apiError, errorBody, type ApiError } from "../errors.js";

export type FinalStatus = "COMPLETED" | "STOPPED" | "FAILED";

// The timer can sometimes fire a few milliseconds early; a small margin so it doesn't land just before a window boundary
const LIVE_TIMER_MARGIN_MS = 5;

interface StartTestRunParams {
  testRunId: string;
  targetRps: number;
  durationSeconds: number;
  url: string;
  method: string;
  body?: string;
  pinnedAddress: string;
  pinnedFamily: 4 | 6;
  profile?: LoadProfile;
  io: Server;
}

interface ResultItem {
  statusCode: number;
  errorType: string | null;
  responseTime: number;
  responseSize: number;
  timestamp: number;
}

interface ActiveRun {
  testRunId: string;
  config: {
    url: string;
    method: string;
    body?: string; // So the form is filled with the body too when the page reconnects
    targetRps: number;
    durationSeconds: number;
    profile?: LoadProfile;
  };
  stop: () => Promise<void>;
  snapshot: () => Promise<number>;
}

// --- One test at a time rule ---

let activeRun: ActiveRun | null = null;
let slotReserved = false;

// The route calls this BEFORE touching the database. No await in between, so there's no race.
export function reserveTestSlot(): boolean {
  if (slotReserved) return false;
  slotReserved = true;
  return true;
}

// If an error occurs before the test could start, the route releases the lock
export function releaseTestSlot(): void {
  if (!activeRun) slotReserved = false;
}

export function getActiveTestRun() {
  if (!activeRun) return null;
  return { testRunId: activeRun.testRunId, config: activeRun.config };
}


// Called when the page reconnects to the running test: writes the buffered results to the database and returns
// the number of windows sent on the live stream so far. Those windows come from the database, later ones from the live stream.
// null if the test isn't running (or it's a different test).
export async function snapshotActiveTest(testRunId: string): Promise<number | null> {
  if (!activeRun || activeRun.testRunId !== testRunId) return null;
  return activeRun.snapshot();
}

// --- Helpers ---

function toDbRows(testRunId: string, items: ResultItem[]) {
  return items.map((r) => ({
    testRunId,
    statusCode: r.statusCode,
    errorType: r.errorType,
    responseTime: r.responseTime,
    responseSize: r.responseSize,
    timestamp: new Date(r.timestamp),
  }));
}

// --- Test lifecycle ---

export function startTestRun(params: StartTestRunParams): Promise<FinalStatus> {
  if (activeRun) {
    return Promise.reject(new Error("A test is already running."));
  }
  slotReserved = true;

  return new Promise((resolve) => {
    const room = params.io.to(params.testRunId);
    const workerPath = path.join(__dirname, "worker.js");
    const worker = new Worker(workerPath, {
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });

    let testStartTime: number | null = null;
    let dbBuffer: ResultItem[] = [];
    let windowLagMs = 0; // Highest lag in this window
    let lastLagMs = 0; // Last measured lag (the indicator keeps showing it during empty windows)
    let maxLagMs = 0; // Highest lag during the test (written to the database)
    let finalized = false;

    // Live windows: results are placed into windows counted from the test start, by the response's ARRIVAL time
    // (same as the detail page; the analysis uses the request's send time instead). The next window to send is nextWindow.
    const liveWindows = new Map<number, ResultItem[]>();
    let nextWindow = 0;

    // Database writes run in order; one doesn't start until the previous one finishes
    let writeChain: Promise<void> = Promise.resolve();

    function writeToDb(items: ResultItem[]) {
      writeChain = writeChain
        .then(
          () => prisma.testResult.createMany({ data: toDbRows(params.testRunId, items) }).then(() => undefined),
          () => undefined
        )
        .catch((err) => {
          console.error("DB write error:", err);
        });
    }

    // The start time is written in the same order as results (the summary and analysis use it)
    function saveStartedAt(startedAt: number) {
      writeChain = writeChain
        .then(() =>
          prisma.testRun
            .update({ where: { id: params.testRunId }, data: { startedAt: new Date(startedAt) } })
            .then(() => undefined)
        )
        .catch((err) => {
          console.error("Could not save the start time:", err);
        });
    }

    // --- Live stream ---

    // Put the result into its window. A very late result whose window was already sent goes into the next window (so it isn't lost).
    function addToLive(items: ResultItem[]) {
      if (testStartTime === null) return;
      for (const item of items) {
        const index = Math.max(nextWindow, Math.floor((item.timestamp - testStartTime) / LIVE_WINDOW_MS));
        const list = liveWindows.get(index);
        if (list) list.push(item);
        else liveWindows.set(index, [item]);
      }
    }

    // Send one window. Its time is the window's end (0–0.2 → 0.2). Empty windows are sent too, so the chart advances smoothly.
    function emitWindow(index: number, items: ResultItem[]) {
      const s = summarizeWindow(items);
      const elapsedSeconds = ((index + 1) * LIVE_WINDOW_MS) / 1000;

      room.emit("progress", {
        ...s,
        elapsedSeconds,
        bytesPerSecond: s.bytes / (LIVE_WINDOW_MS / 1000),
        windowSeconds: LIVE_WINDOW_MS / 1000,
        targetRps: targetRpsAt(
          (index * LIVE_WINDOW_MS + LIVE_WINDOW_MS / 2) / 1000,
          params.targetRps,
          params.durationSeconds,
          params.profile
        ),
        lagMs: windowLagMs > 0 ? windowLagMs : lastLagMs,
        voltaOverloaded: windowLagMs > WORKER_LAG_WARNING_MS,
      });

      windowLagMs = 0;
    }

    // Send finished windows in order. final: the test ended, send whatever is left.
    function emitReadyWindows(final: boolean) {
      if (testStartTime === null) return;

      const until = final
        ? liveWindows.size > 0
          ? Math.max(...liveWindows.keys()) + 1
          : nextWindow
        : Math.floor((Date.now() - testStartTime - LIVE_EMIT_DELAY_MS) / LIVE_WINDOW_MS);

      while (nextWindow < until) {
        emitWindow(nextWindow, liveWindows.get(nextWindow) ?? []);
        liveWindows.delete(nextWindow);
        nextWindow++;
      }
    }

    const flushInterval = setInterval(() => {
      if (dbBuffer.length === 0) return;
      const toWrite = dbBuffer;
      dbBuffer = [];
      writeToDb(toWrite);
    }, DB_FLUSH_INTERVAL_MS);

    // Live window timer: aligned to the test start. It runs LIVE_EMIT_DELAY_MS after each window ends
    // and sends exactly one window. (An unaligned setInterval, landing near a window boundary,
    // sometimes sent 0 and sometimes 2 windows and made the chart jerky.) If it runs late, it sends the missed ones next time.
    let liveTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleLiveTick() {
      if (testStartTime === null || finalized) return;

      const nextDue =
        testStartTime + (nextWindow + 1) * LIVE_WINDOW_MS + LIVE_EMIT_DELAY_MS + LIVE_TIMER_MARGIN_MS;

      liveTimer = setTimeout(() => {
        emitReadyWindows(false);
        scheduleLiveTick();
      }, Math.max(0, nextDue - Date.now()));
    }

    // However the test ends (completed, stopped, error) it goes through here; runs only once
    async function finalize(status: FinalStatus, error?: ApiError) {
      if (finalized) return;
      finalized = true;

      clearInterval(flushInterval);
      if (liveTimer) clearTimeout(liveTimer);
      await worker.terminate();

      // Write what's left in the buffer, wait for pending writes to finish
      if (dbBuffer.length > 0) {
        writeToDb(dbBuffer);
        dbBuffer = [];
      }
      await writeChain;

      emitReadyWindows(true);

      // The summary is computed after all results are written
      try {
        const summary = await computeTestSummary(params.testRunId);
        await prisma.testRun.update({
          where: { id: params.testRunId },
          data: { status, finishedAt: new Date(), ...summary, maxLagMs: Math.round(maxLagMs) },
        });
      } catch (err) {
        console.error("Could not save the test summary:", err);
      }

      if (status === "FAILED") {
        room.emit("error", errorBody(error ?? apiError("TEST_UNEXPECTED_ERROR")));
      } else {
        room.emit("done", { status });
      }

      activeRun = null;
      slotReserved = false;
      resolve(status);
    }

    activeRun = {
      testRunId: params.testRunId,
      config: {
        url: params.url,
        method: params.method,
        body: params.body,
        targetRps: params.targetRps,
        durationSeconds: params.durationSeconds,
        profile: params.profile,
      },
      stop: () => finalize("STOPPED"),
      // All results of the sent windows are now either in the buffer or in the database: write the buffer, return the boundary
      snapshot: async () => {
        const sentWindows = nextWindow;
        if (dbBuffer.length > 0) {
          writeToDb(dbBuffer);
          dbBuffer = [];
        }
        await writeChain;
        return sentWindows;
      },
    };

    worker.on("message", (message) => {
      // The test's start time: live windows count from here; it's also written to the database
      if (message.type === "started") {
        testStartTime = message.startedAt;
        saveStartedAt(message.startedAt);
        scheduleLiveTick();
      }

      if (message.type === "batch") {
        // The "started" message always comes first; if it didn't (not expected), use the first batch's time
        if (testStartTime === null) {
          testStartTime = Date.now();
          scheduleLiveTick();
        }
        dbBuffer.push(...message.results);
        addToLive(message.results);

        const lagMs = message.lagMs ?? 0;
        windowLagMs = Math.max(windowLagMs, lagMs);
        lastLagMs = lagMs;

        // Lag in the first second isn't recorded: it can spike briefly while the worker warms up
        if (Date.now() - testStartTime >= 1000) {
          maxLagMs = Math.max(maxLagMs, lagMs);
        }
      }

      if (message.type === "done") {
        void finalize("COMPLETED");
      }

      if (message.type === "error") {
        void finalize("FAILED", apiError("TEST_UNEXPECTED_ERROR"));
      }
    });

    worker.on("error", (err) => {
      console.error("Worker error:", err);
      void finalize("FAILED", apiError("TEST_UNEXPECTED_ERROR"));
    });

    // An exit we didn't trigger (crash, memory limit, etc.)
    worker.on("exit", () => {
      void finalize("FAILED", apiError("WORKER_EXITED"));
    });

    worker.postMessage({
      targetRps: params.targetRps,
      durationSeconds: params.durationSeconds,
      url: params.url,
      method: params.method,
      body: params.body,
      pinnedAddress: params.pinnedAddress,
      pinnedFamily: params.pinnedFamily,
      profile: params.profile,
    });
  });
}

export function stopTestRun(testRunId: string): boolean {
  if (!activeRun || activeRun.testRunId !== testRunId) return false;
  void activeRun.stop();
  return true;
}