import { Worker } from "node:worker_threads";
import path from "node:path";
import type { Server } from "socket.io";
import { prisma } from "../db/prisma.js";
import { targetRpsAt, type LoadProfile } from "./scheduler.js";
import { computeTestSummary } from "./summary.js";
import { summarizeWindow } from "./windowStats.js";
import { DB_FLUSH_INTERVAL_MS, LIVE_WINDOW_MS, WORKER_LAG_WARNING_MS } from "../config.js";
import { apiError, errorBody, type ApiError } from "../errors.js";

export type FinalStatus = "COMPLETED" | "STOPPED" | "FAILED";

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
  startedAt: number;
  config: {
    url: string;
    method: string;
    targetRps: number;
    durationSeconds: number;
    profile?: LoadProfile;
  };
  stop: () => Promise<void>;
}

// --- Aynı anda tek test kuralı ---

let activeRun: ActiveRun | null = null;
let slotReserved = false;

// Route, veritabanına dokunmadan ÖNCE çağırır. Arada bekleme olmadığı için yarış oluşmaz.
export function reserveTestSlot(): boolean {
  if (slotReserved) return false;
  slotReserved = true;
  return true;
}

// Test başlatılamadan önce bir hata olursa route kilidi bırakır
export function releaseTestSlot(): void {
  if (!activeRun) slotReserved = false;
}

export function getActiveTestRun() {
  if (!activeRun) return null;
  return { testRunId: activeRun.testRunId, startedAt: activeRun.startedAt, config: activeRun.config };
}

// --- Yardımcılar ---

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

// --- Test yaşam döngüsü ---

export function startTestRun(params: StartTestRunParams): Promise<FinalStatus> {
  if (activeRun) {
    return Promise.reject(new Error("Zaten çalışan bir test var."));
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
    let socketBuffer: ResultItem[] = [];
    let windowLagMs = 0;
    let maxLagMs = 0; // Test boyunca en yüksek gecikme (veritabanına yazılır)
    let finalized = false;

    // Veritabanı yazmaları sırayla yapılır, bir yazma bitmeden diğeri başlamaz
    let writeChain: Promise<void> = Promise.resolve();

    function writeToDb(items: ResultItem[]) {
      writeChain = writeChain
        .then(
          () => prisma.testResult.createMany({ data: toDbRows(params.testRunId, items) }).then(() => undefined),
          () => undefined
        )
        .catch((err) => {
          console.error("DB yazma hatası:", err);
        });
    }

    function emitWindow(items: ResultItem[]) {
      if (items.length === 0 || testStartTime === null) return;

      const elapsedSeconds = (Date.now() - testStartTime) / 1000;
      const s = summarizeWindow(items);

      room.emit("progress", {
        ...s,
        elapsedSeconds,
        bytesPerSecond: s.bytes / (LIVE_WINDOW_MS / 1000),
        windowSeconds: LIVE_WINDOW_MS / 1000,
        targetRps: targetRpsAt(
          Math.max(0, elapsedSeconds - LIVE_WINDOW_MS / 2000),
          params.targetRps,
          params.durationSeconds,
          params.profile
        ),
        lagMs: windowLagMs,
        voltaOverloaded: windowLagMs > WORKER_LAG_WARNING_MS,
      });

      windowLagMs = 0;
    }

    const flushInterval = setInterval(() => {
      if (dbBuffer.length === 0) return;
      const toWrite = dbBuffer;
      dbBuffer = [];
      writeToDb(toWrite);
    }, DB_FLUSH_INTERVAL_MS);

    const socketInterval = setInterval(() => {
      const toSend = socketBuffer;
      socketBuffer = [];
      emitWindow(toSend);
    }, LIVE_WINDOW_MS);

    // Test nasıl biterse bitsin (tamamlandı, durduruldu, hata) buradan geçer, sadece bir kez çalışır
    async function finalize(status: FinalStatus, error?: ApiError) {
      if (finalized) return;
      finalized = true;

      clearInterval(flushInterval);
      clearInterval(socketInterval);
      await worker.terminate();

      // Tamponda kalanları yaz, bekleyen yazmaların bitmesini bekle
      if (dbBuffer.length > 0) {
        writeToDb(dbBuffer);
        dbBuffer = [];
      }
      await writeChain;

      emitWindow(socketBuffer);
      socketBuffer = [];

      // Özet bütün sonuçlar yazıldıktan sonra hesaplanır
      try {
        const summary = await computeTestSummary(params.testRunId);
        await prisma.testRun.update({
          where: { id: params.testRunId },
          data: { status, finishedAt: new Date(), ...summary, maxLagMs: Math.round(maxLagMs) },
        });
      } catch (err) {
        console.error("Test özeti kaydedilemedi:", err);
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
      startedAt: Date.now(),
      config: {
        url: params.url,
        method: params.method,
        targetRps: params.targetRps,
        durationSeconds: params.durationSeconds,
        profile: params.profile,
      },
      stop: () => finalize("STOPPED"),
    };

    worker.on("message", (message) => {
      if (message.type === "batch") {
        if (testStartTime === null) testStartTime = Date.now();
        dbBuffer.push(...message.results);
        socketBuffer.push(...message.results);

        const lagMs = message.lagMs ?? 0;
        windowLagMs = Math.max(windowLagMs, lagMs);

        // İlk saniyedeki gecikme kaydedilmez: worker ısınırken kısa süre yükselebilir
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
      console.error("Worker hatası:", err);
      void finalize("FAILED", apiError("TEST_UNEXPECTED_ERROR"));
    });

    // Bizim kapatmadığımız bir kapanma (çökme, bellek sınırı vb.)
    worker.on("exit", () => {
      void finalize("FAILED", apiError("WORKER_EXITED"));
    });

    worker.postMessage({
      testRunId: params.testRunId,
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