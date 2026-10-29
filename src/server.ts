// .env must load before everything else: config.ts (VOLTA_PORT) and db/prisma.ts (DATABASE_URL) read it
import "./env.js";
import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createTestRunRouter } from "./routes/testRun.js";
import { prisma } from "./db/prisma.js";
import { computeTestSummary } from "./engine/summary.js";
import {
  VOLTA_HOST,
  VOLTA_PORT,
  ALLOWED_HOSTNAMES,
  MIN_TARGET_RPS,
  MAX_TARGET_RPS,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
  MIN_STEP_COUNT,
  MAX_STEP_COUNT,
  MIN_STEP_DURATION_SECONDS,
  REQUEST_TIMEOUT_MS,
  MAX_BODY_KB,
  MAX_HEADERS,
  MAX_HEADER_BYTES,
  validateConfig,
} from "./config.js";
import { createSavedTargetRouter } from "./routes/savedTargets.js";
import { apiError, errorBody } from "./errors.js";

// --- Security: does the request come from Volta's own address? ---
// Volta is reachable only from this computer (127.0.0.1), but another site open in the browser
// may try to send requests to Volta through the browser. Three checks:
//   Host:   the name in the browser's address bar. A name like "evil.example:4400" is rejected (DNS rebinding).
//   Origin: which site sent the request. For state-changing requests and the live connection,
//           only Volta's own page is accepted. If there's no Origin (non-browser tools like curl), it's allowed.
//   Frame:  Volta can't be opened inside another site (iframe) (clickjacking with an invisible frame).

// The browser always puts the port in Host (port 80 is forbidden in the settings)
const allowedHosts = new Set(ALLOWED_HOSTNAMES.map((name) => `${name}:${VOLTA_PORT}`));
const allowedOrigins = new Set(ALLOWED_HOSTNAMES.map((name) => `http://${name}:${VOLTA_PORT}`));

function isAllowedHost(host: string | undefined): boolean {
  return host !== undefined && allowedHosts.has(host.toLowerCase());
}

function isAllowedOrigin(origin: string | undefined): boolean {
  return origin === undefined || allowedOrigins.has(origin.toLowerCase());
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Test IDs are UUIDs. Anything else sent when joining a room is ignored.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- App ---

const app = express();

// Don't send "X-Powered-By: Express" in responses (unnecessary information)
app.disable("x-powered-by");

// Security check before every request (pages included)
app.use((req, res, next) => {
  if (!isAllowedHost(req.headers.host)) {
    return res.status(403).json(errorBody(apiError("FORBIDDEN_HOST", { port: VOLTA_PORT })));
  }
  if (STATE_CHANGING_METHODS.has(req.method) && !isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json(errorBody(apiError("FORBIDDEN_ORIGIN")));
  }
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// The test start request carries the JSON body and the headers. Room is left for the headers on top of the body
// (twice their size, for the escaping in JSON, plus 1 KB for the other fields), so a body at its limit plus headers still fits.
const REQUEST_LIMIT_KB = MAX_BODY_KB + Math.ceil((MAX_HEADER_BYTES * 2) / 1024) + 1;
app.use(express.json({ limit: `${REQUEST_LIMIT_KB}kb` }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Settings the UI needs: its own checks, the inputs' hints, the chart's latency axis and texts that mention
// the timeout. They are only written in config.ts; when they change, the UI follows automatically.
app.get("/api/limits", (req, res) => {
  res.json({
    minTargetRps: MIN_TARGET_RPS,
    maxTargetRps: MAX_TARGET_RPS,
    minDurationSeconds: MIN_DURATION_SECONDS,
    maxDurationSeconds: MAX_DURATION_SECONDS,
    minStepCount: MIN_STEP_COUNT,
    maxStepCount: MAX_STEP_COUNT,
    minStepDurationSeconds: MIN_STEP_DURATION_SECONDS,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    maxBodyKb: MAX_BODY_KB,
    maxHeaders: MAX_HEADERS,
    maxHeaderBytes: MAX_HEADER_BYTES,
  });
});

const httpServer = createServer(app);

// Live connection: it doesn't go through Express's check (Socket.io handles its own path), so the same check is here.
// The Origin check matters especially because browsers don't apply CORS rules to WebSockets.
const io = new Server(httpServer, {
  allowRequest: (req, callback) => {
    callback(null, isAllowedHost(req.headers.host) && isAllowedOrigin(req.headers.origin));
  },
});

app.use("/api/test-run", createTestRunRouter(io));
app.use("/api/targets", createSavedTargetRouter());

// Unknown paths under /api: JSON instead of Express's HTML page
app.use("/api", (req, res) => {
  res.status(404).json(errorBody(apiError("API_NOT_FOUND")));
});

// Error handler: errors while reading the body or in a route. Must be last (four parameters).
// The response is always { error, code }; stack traces and file paths aren't sent to the user, they're written to the terminal.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  if (err?.type === "entity.too.large") {
    return res.status(413).json(errorBody(apiError("BODY_TOO_LARGE", { max: `${MAX_BODY_KB} KB` })));
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json(errorBody(apiError("INVALID_JSON")));
  }

  console.error("Unexpected server error:", err);
  res.status(500).json(errorBody(apiError("INTERNAL_ERROR")));
});

io.on("connection", (socket) => {
  // Joining a test room (to listen to the live stream). Only values shaped like a test ID are accepted.
  socket.on("join-test", (testRunId: unknown) => {
    if (typeof testRunId !== "string" || !UUID_PATTERN.test(testRunId)) return;
    socket.join(testRunId);
  });
});

// If Volta shut down during a test, those tests stay RUNNING.
// On startup, mark them INTERRUPTED and compute their summaries from the available data.
async function markInterruptedRuns() {
  const stuckRuns = await prisma.testRun.findMany({
    where: { status: "RUNNING" },
    select: { id: true, startedAt: true, createdAt: true },
  });

  for (const run of stuckRuns) {
    try {
      const summary = await computeTestSummary(run.id);

      // End time: the last saved result. (Not when Volta restarted; that could be hours later
      // and the analysis would treat every second in between as "no response" and blame the server.) If there are no results, the start.
      const last = await prisma.testResult.findFirst({
        where: { testRunId: run.id },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true },
      });
      const finishedAt = last?.timestamp ?? run.startedAt ?? run.createdAt;

      await prisma.testRun.update({
        where: { id: run.id },
        data: { status: "INTERRUPTED", finishedAt, ...summary },
      });
    } catch (err) {
      console.error(`Could not mark test ${run.id}:`, err);
    }
  }

  if (stuckRuns.length > 0) {
    console.log(`Marked ${stuckRuns.length} interrupted test(s) as INTERRUPTED.`);
  }
}

async function main() {
  // Settings first: don't start with an invalid value (0-second test, wrong port...), say what's wrong
  const problems = validateConfig();
  if (problems.length > 0) {
    console.error("Volta could not start: invalid settings (src/config.ts or .env).");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("Fix them and restart Volta.");
    process.exit(1);
  }

  await markInterruptedRuns();

  httpServer.listen(VOLTA_PORT, VOLTA_HOST, () => {
    console.log(`Volta server is running at http://localhost:${VOLTA_PORT}.`);
  });
}

main().catch((err) => {
  console.error("Volta could not start:", err);
  process.exit(1);
});