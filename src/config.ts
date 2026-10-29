// Volta's settings are managed in one place.
// You can change the values; on startup Volta checks them against the rules at the end of this file,
// and if a value is invalid Volta won't start and prints what's wrong to the terminal.

// Address and port Volta's UI runs on.
// 127.0.0.1: reachable only from this computer, not by others on the same network.
export const VOLTA_HOST = "127.0.0.1";
// Port comes from VOLTA_PORT in .env (4400 if missing). It's deliberately not named "PORT": many developers set
// PORT=3000 in their terminal for their own project, and Volta shouldn't pick that up and clash with the tested project.
// The address (VOLTA_HOST) can't be changed from .env, so Volta is never accidentally exposed to the whole network.
export const VOLTA_PORT = Number(process.env.VOLTA_PORT ?? 4400);

// Volta can be reached from the browser only under these names (port VOLTA_PORT). Requests under any other name are rejected:
// this stops a malicious site from pointing its own domain at 127.0.0.1 and using Volta through the browser
// (DNS rebinding).
export const ALLOWED_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

// Test limits (the UI also gets these from /api/limits)
export const MIN_TARGET_RPS = 10;
export const MAX_TARGET_RPS = 1000;
export const MIN_DURATION_SECONDS = 1;
export const MAX_DURATION_SECONDS = 60;

// Stepped test limits
export const MIN_STEP_COUNT = 2;
export const MAX_STEP_COUNT = 10;
// Each step must last at least this long (to be able to see the queue grow)
export const MIN_STEP_DURATION_SECONDS = 2;

// Wait time for the connection attempt in the pre-check
export const CONNECT_CHECK_TIMEOUT_MS = 2000;


// How long Volta waits for a response before counting the request as a timeout.
// Raise it to test slow endpoints (e.g. AI calls). Allowed: 1000–30000 ms. The upper limit keeps the number of
// open requests in check: on a slow server, 1000 RPS with a 30 s timeout can mean 30,000 requests in flight.
export const REQUEST_TIMEOUT_MS = 2500;

// Live stream and database write intervals.
// LIVE_WINDOW_MS is the chart's window length: the live chart, page reload and detail page use the same value.
// It must divide 1000 evenly (100, 200, 250, 500...): the chart builds seconds from these windows.
export const LIVE_WINDOW_MS = 200;
export const DB_FLUSH_INTERVAL_MS = 500;


// The worker sends results in batches at this interval. The live stream sends a window LIVE_EMIT_DELAY_MS after it ends:
// this value must be greater than WORKER_BATCH_INTERVAL_MS so the window's last batch also makes it in.
export const WORKER_BATCH_INTERVAL_MS = 100;
export const LIVE_EMIT_DELAY_MS = 150;

// If the worker's own lag exceeds this value, a "Volta is under strain" warning is shown
export const WORKER_LAG_WARNING_MS = 50;

// Maximum target URL length (test start and target book)
export const MAX_URL_LENGTH = 2000;

// Largest JSON body accepted for a test (KB). Allowed: 1–1024. The body is sent with every request and saved with the test.
export const MAX_BODY_KB = 100;

// Custom request headers: how many a test can have, and their total size (name + value, in bytes).
// Most servers reject headers above 8–16 KB with "431 Request Header Fields Too Large". Allowed: 1–16384 bytes.
export const MAX_HEADERS = 20;
export const MAX_HEADER_BYTES = 8192;

// Longest text allowed in search boxes (history list and target book)
export const MAX_SEARCH_LENGTH = 200;

// --- Settings validation ---
// Runs when Volta starts (server.ts). These rules are required for the code to work correctly:
// settings can be changed, rules can't. All problems are listed at once.
// Messages are in English (shown in the terminal).

// MAX_TARGET_RPS can be raised to at most this value. Above it the scheduler and worker can't keep up,
// and measurements become unreliable (Volta lag was measured at ~14 ms at 1000 RPS).
const RPS_CEILING = 4000;

const REQUEST_TIMEOUT_CEILING_MS = 30000;
const BODY_CEILING_KB = 1024;
const HEADER_BYTES_CEILING = 16384;

export function validateConfig(): string[] {
  const problems: string[] = [];

  // Is it a whole number of at least "min"?
  const wholeAtLeast = (name: string, value: number, min: number) => {
    if (!Number.isInteger(value) || value < min) {
      problems.push(`${name} must be a whole number of at least ${min} (current: ${value})`);
    }
  };

  // Is it a number greater than 0?
  const positive = (name: string, value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      problems.push(`${name} must be greater than 0 (current: ${value})`);
    }
  };

  // The upper limit must not be below the lower limit
  const notBelow = (maxName: string, max: number, minName: string, min: number) => {
    if (max < min) {
      problems.push(`${maxName} (${max}) cannot be lower than ${minName} (${min})`);
    }
  };

  // Port: comes from an environment variable, could be "abc" or empty
  if (!Number.isInteger(VOLTA_PORT) || VOLTA_PORT < 1 || VOLTA_PORT > 65535) {
    problems.push(`VOLTA_PORT must be a whole number between 1 and 65535 (current: "${process.env.VOLTA_PORT}")`);
  }

  // Browsers leave the default port (80) out of the address; Volta's security checks expect the port in the address
  if (VOLTA_PORT === 80) {
    problems.push("VOLTA_PORT cannot be 80 (browsers leave the default port out of the address). Use another port, e.g. 4400");
  }

  // Test limits: a 0-second test or one sending 0 requests per second is meaningless
  wholeAtLeast("MIN_TARGET_RPS", MIN_TARGET_RPS, 1);
  wholeAtLeast("MAX_TARGET_RPS", MAX_TARGET_RPS, 1);
  notBelow("MAX_TARGET_RPS", MAX_TARGET_RPS, "MIN_TARGET_RPS", MIN_TARGET_RPS);
  if (MAX_TARGET_RPS > RPS_CEILING) {
    problems.push(`MAX_TARGET_RPS cannot be higher than ${RPS_CEILING} (current: ${MAX_TARGET_RPS})`);
  }

  wholeAtLeast("MIN_DURATION_SECONDS", MIN_DURATION_SECONDS, 1);
  wholeAtLeast("MAX_DURATION_SECONDS", MAX_DURATION_SECONDS, 1);
  notBelow("MAX_DURATION_SECONDS", MAX_DURATION_SECONDS, "MIN_DURATION_SECONDS", MIN_DURATION_SECONDS);

  // Stepped test: a single step would be the same as a constant test
  wholeAtLeast("MIN_STEP_COUNT", MIN_STEP_COUNT, 2);
  wholeAtLeast("MAX_STEP_COUNT", MAX_STEP_COUNT, 2);
  notBelow("MAX_STEP_COUNT", MAX_STEP_COUNT, "MIN_STEP_COUNT", MIN_STEP_COUNT);
  positive("MIN_STEP_DURATION_SECONDS", MIN_STEP_DURATION_SECONDS);

  // Time intervals
  positive("CONNECT_CHECK_TIMEOUT_MS", CONNECT_CHECK_TIMEOUT_MS);
  positive("DB_FLUSH_INTERVAL_MS", DB_FLUSH_INTERVAL_MS);
  positive("WORKER_LAG_WARNING_MS", WORKER_LAG_WARNING_MS);
  
  positive("WORKER_BATCH_INTERVAL_MS", WORKER_BATCH_INTERVAL_MS);
  positive("LIVE_EMIT_DELAY_MS", LIVE_EMIT_DELAY_MS);
  if (LIVE_EMIT_DELAY_MS <= WORKER_BATCH_INTERVAL_MS) {
    problems.push(
      `LIVE_EMIT_DELAY_MS (${LIVE_EMIT_DELAY_MS}) must be greater than WORKER_BATCH_INTERVAL_MS (${WORKER_BATCH_INTERVAL_MS})`
    );
  }

  // The chart builds seconds from windows: a second must hold a whole number of windows
  wholeAtLeast("LIVE_WINDOW_MS", LIVE_WINDOW_MS, 1);
  if (Number.isInteger(LIVE_WINDOW_MS) && LIVE_WINDOW_MS > 0 && 1000 % LIVE_WINDOW_MS !== 0) {
    problems.push(`LIVE_WINDOW_MS must divide 1000 evenly, e.g. 100, 200, 250, 500 (current: ${LIVE_WINDOW_MS})`);
  }

    // Request timeout and body size
  wholeAtLeast("REQUEST_TIMEOUT_MS", REQUEST_TIMEOUT_MS, 1000);
  if (REQUEST_TIMEOUT_MS > REQUEST_TIMEOUT_CEILING_MS) {
    problems.push(`REQUEST_TIMEOUT_MS cannot be higher than ${REQUEST_TIMEOUT_CEILING_MS} (current: ${REQUEST_TIMEOUT_MS})`);
  }
    wholeAtLeast("MAX_BODY_KB", MAX_BODY_KB, 1);
  if (MAX_BODY_KB > BODY_CEILING_KB) {
    problems.push(`MAX_BODY_KB cannot be higher than ${BODY_CEILING_KB} (current: ${MAX_BODY_KB})`);
  }

  // Custom headers
  wholeAtLeast("MAX_HEADERS", MAX_HEADERS, 1);
  wholeAtLeast("MAX_HEADER_BYTES", MAX_HEADER_BYTES, 1);
  if (MAX_HEADER_BYTES > HEADER_BYTES_CEILING) {
    problems.push(`MAX_HEADER_BYTES cannot be higher than ${HEADER_BYTES_CEILING} (current: ${MAX_HEADER_BYTES})`);
  }

  wholeAtLeast("MAX_URL_LENGTH", MAX_URL_LENGTH, 1);
  wholeAtLeast("MAX_SEARCH_LENGTH", MAX_SEARCH_LENGTH, 1);
  
  return problems;
}