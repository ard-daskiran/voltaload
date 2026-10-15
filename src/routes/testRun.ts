// testRun.ts
// Test endpoints: take the request, call the matching service, send the response.
// Validation → services/startRequest.ts, calculations → services/resultQueries.ts
// Errors are sent as { error, code, params } (errors.ts).

import { Router } from "express";
import type { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.js";
import {
  startTestRun,
  stopTestRun,
  reserveTestSlot,
  releaseTestSlot,
  getActiveTestRun,
  snapshotActiveTest,
} from "../engine/testRunManager.js";
import { resolveTarget } from "../engine/security.js";
import { validateStartRequest } from "../services/startRequest.js";
import { getLiveWindows, getTestDetail } from "../services/resultQueries.js";
import { parseListQuery, listTestRuns } from "../services/testRunList.js";
import { deleteTestRun, clearAllTestRuns } from "../services/testRunDelete.js";
import { analyzeTestRun } from "../analysis/index.js";
import { apiError, errorBody } from "../errors.js";

export function createTestRunRouter(io: Server): Router {
  const testRunRouter = Router();

  // Start a test
  testRunRouter.post("/", async (req, res) => {
    const validation = validateStartRequest(req.body);
    if (!validation.ok) {
      return res.status(400).json(errorBody(validation.error));
    }
    const input = validation.value;

    // The lock is taken BEFORE touching the database and the security check (prevents a race)
    if (!reserveTestSlot()) {
      return res.status(409).json(errorBody(apiError("TEST_ALREADY_RUNNING")));
    }

    let started = false;

    try {
      const security = await resolveTarget(input.url);
      if (!security.ok) {
        return res.status(400).json(errorBody(security.error));
      }

      const testRunId = randomUUID();
      const bodyString = input.body !== undefined ? JSON.stringify(input.body) : undefined;

      await prisma.testRun.create({
        data: {
          id: testRunId,
          url: input.url,
          method: input.method,
          body: bodyString ?? null,
          targetRps: input.targetRps,
          duration: input.duration,
          loadProfile: input.profile.type,
          stepCount: input.profile.type === "STEPPED" ? input.profile.stepCount ?? null : null,
        },
      });

      startTestRun({
        testRunId,
        targetRps: input.targetRps,
        durationSeconds: input.duration,
        url: input.url,
        method: input.method,
        body: bodyString,
        pinnedAddress: security.target.address,
        pinnedFamily: security.target.family,
        profile: input.profile,
        io,
      }).catch((err) => {
        console.error(`Test ${testRunId} could not be started:`, err.message);
      });

      started = true;
      res.status(201).json({ testRunId });
    } catch (err) {
      console.error("Test could not be started:", err);
      res.status(500).json(errorBody(apiError("START_FAILED")));
    } finally {
      // Release the lock if the test didn't start
      if (!started) releaseTestSlot();
    }
  });

  // Stop the test
  testRunRouter.post("/:id/stop", (req, res) => {
    const stopped = stopTestRun(req.params.id);

    if (!stopped) {
      return res.status(404).json(errorBody(apiError("NO_ACTIVE_TEST")));
    }

    res.json({ stopping: true });
  });

  // The currently running test (to reconnect after a page reload).
  // Must be defined before the /:id/... routes so "active" isn't taken for a test ID.
  testRunRouter.get("/active", (req, res) => {
    res.json({ active: getActiveTestRun() });
  });

  // History list: ?page=2&pageSize=20&method=GET&search=products&sort=newest
  testRunRouter.get("/", async (req, res) => {
    const query = parseListQuery(req.query as Record<string, unknown>);
    res.json(await listTestRuns(query));
  });

  // A test's data so far, in the same shape as the live stream
  testRunRouter.get("/:id/live", async (req, res) => {
    // If the test is running: buffered results are written first and only windows already sent on the live stream are returned.
    // Later ones come from the live stream (so a window doesn't arrive half from each source and no request is lost).
    const untilWindow = await snapshotActiveTest(req.params.id);
    const windows = await getLiveWindows(req.params.id, untilWindow ?? undefined);
    if (!windows) {
      return res.status(404).json(errorBody(apiError("TEST_NOT_FOUND")));
    }

    res.json({ windows });
  });

  // Automatic analysis: status, capacity, step table, events, recommendations
  testRunRouter.get("/:id/analysis", async (req, res) => {
    const analysis = await analyzeTestRun(req.params.id);
    if (!analysis) {
      return res.status(404).json(errorBody(apiError("TEST_NOT_FOUND")));
    }

    res.json(analysis);
  });

  // Detail page: the test's record and summary (chart data comes from /:id/live)
  testRunRouter.get("/:id", async (req, res) => {
    const detail = await getTestDetail(req.params.id);
    if (!detail) {
      return res.status(404).json(errorBody(apiError("TEST_NOT_FOUND")));
    }

    res.json(detail);
  });

  // Delete all tests (clear the database)
  testRunRouter.delete("/", async (req, res) => {
    const result = await clearAllTestRuns();
    if (!result.ok) {
      return res.status(409).json(errorBody(apiError("TEST_ALREADY_RUNNING")));
    }

    res.json({ deletedRuns: result.deletedRuns, deletedResults: result.deletedResults });
  });

  // Delete a single test
  testRunRouter.delete("/:id", async (req, res) => {
    const result = await deleteTestRun(req.params.id);
    if (!result.ok) {
      return result.reason === "notFound"
        ? res.status(404).json(errorBody(apiError("TEST_NOT_FOUND")))
        : res.status(409).json(errorBody(apiError("TEST_RUNNING")));
    }

    res.status(204).end();
  });

  return testRunRouter;
}