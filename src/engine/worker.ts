import { parentPort } from "node:worker_threads";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { Agent, request } from "undici";
import { runScheduledLoop, type LoadProfile } from "./scheduler.js";
import { REQUEST_TIMEOUT_MS, WORKER_BATCH_INTERVAL_MS } from "../config.js";

if (!parentPort) {
  throw new Error("This file must only be run inside a worker thread.");
}

const port = parentPort;

type ErrorType = "TIMEOUT" | "CONNECTION_REFUSED" | "CONNECTION_RESET" | "NETWORK_ERROR";

interface StartMessage {
  targetRps: number;
  durationSeconds: number;
  url: string;
  method: string;
  body?: string;
  pinnedAddress: string;
  pinnedFamily: 4 | 6;
  profile?: LoadProfile;
}

interface RequestResult {
  statusCode: number; // 0 if no response arrived
  errorType: ErrorType | null;
  responseTime: number; // ms
  responseSize: number; // bytes (downloaded over the network, compressed)
  timestamp: number; // when the response completed (ms)
}

function classifyError(err: any): ErrorType {
  const code = err?.code ?? err?.cause?.code;
  if (code === "ECONNREFUSED") return "CONNECTION_REFUSED";
  if (code === "ECONNRESET" || code === "EPIPE" || code === "UND_ERR_SOCKET") return "CONNECTION_RESET";
  return "NETWORK_ERROR";
}

async function makeRequest(
  agent: Agent,
  url: string,
  method: string,
  body: string | undefined
): Promise<RequestResult> {
  const start = performance.now();
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const sendsBody = method !== "GET" && body !== undefined;

  try {
    const response = await request(url, {
      dispatcher: agent,
      method: method as any,
      body: sendsBody ? body : undefined,
      headers: {
        // Ask for a compressed response like a browser does. undici doesn't decompress it.
        "accept-encoding": "gzip, deflate, br",
        ...(sendsBody ? { "content-type": "application/json" } : {}),
      },
      signal,
    });

    // Read the whole body but don't keep it: only count its size.
    // This way the time is measured realistically and the connection can be reused.
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
    }

    return {
      statusCode: response.statusCode,
      errorType: null,
      responseTime: Math.round(performance.now() - start),
      responseSize: size,
      timestamp: Date.now(),
    };
  } catch (err) {
    // Determine the error type from our own timer, not from the error object's name
    if (signal.aborted) {
      return {
        statusCode: 0,
        errorType: "TIMEOUT",
        responseTime: REQUEST_TIMEOUT_MS,
        responseSize: 0,
        timestamp: Date.now(),
      };
    }

    return {
      statusCode: 0,
      errorType: classifyError(err),
      responseTime: Math.round(performance.now() - start),
      responseSize: 0,
      timestamp: Date.now(),
    };
  }
}

port.on("message", async (message: StartMessage) => {
  const {
    targetRps,
    durationSeconds,
    url,
    method,
    body,
    pinnedAddress,
    pinnedFamily,
    profile,
  } = message;

  // DNS pinning: every connection goes to the address approved by the main thread.
  // Node can do the address lookup in two forms (single address or list); we answer both.
  const agent = new Agent({
    connect: {
      // Certificate verification is off: local HTTPS servers almost always use self-signed certificates
      // (like mkcert, Vite --https); with verification on, every request would be a "network error". Targets are
      // local addresses only anyway (security.ts); curl -k and Postman's "SSL verification" setting do the same.
      rejectUnauthorized: false,
      lookup: (_hostname: string, options: any, callback: any) => {
        if (options?.all) {
          callback(null, [{ address: pinnedAddress, family: pinnedFamily }]);
        } else {
          callback(null, pinnedAddress, pinnedFamily);
        }
      },
    } as any,
  });

  // The worker's own lag (can Volta itself keep up?)
  const loopDelay = monitorEventLoopDelay({ resolution: 10 });
  loopDelay.enable();

  let batch: RequestResult[] = [];

  function flush() {
    if (batch.length === 0) return;

    const p99 = loopDelay.percentile(99);
    const lagMs = Number.isFinite(p99) ? Math.round(p99 / 1_000_000) : 0;
    loopDelay.reset();

    port.postMessage({ type: "batch", results: batch, lagMs });
    batch = [];
  }

  // Send by time, not by count: the chart keeps moving even if the server slows down
  const flushTimer = setInterval(flush, WORKER_BATCH_INTERVAL_MS);

  const inFlight = new Set<Promise<void>>();

  // The test's start time: the scheduler's zero point (the first request goes out at this moment).
  // Analysis, summary and chart seconds are counted from here.
  port.postMessage({ type: "started", startedAt: Date.now() });

  await runScheduledLoop(
    targetRps,
    durationSeconds,
    () => {
      const pending: Promise<void> = makeRequest(agent, url, method, body)
        .then((result) => {
          batch.push(result);
        })
        .finally(() => {
          inFlight.delete(pending);
        });
      inFlight.add(pending);
    },
    profile
  );

  // Time's up: wait for in-flight requests to finish (at most the timeout)
  await Promise.allSettled([...inFlight]);

  clearInterval(flushTimer);
  flush();
  loopDelay.disable();

  await agent.close();
  port.postMessage({ type: "done" });
});