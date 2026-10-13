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

// Canlı dilim, süresi dolduktan bu kadar sonra gönderilir: worker sonuçları 100 ms'de bir topluyor,
// o dilime ait geç gelen sonuçlar da yetişsin.
const LIVE_EMIT_DELAY_MS = 150;
// Zamanlayıcı bazen birkaç milisaniye erken çalışabilir; dilim sınırının hemen önüne düşmesin diye küçük pay
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
  startedAt: number;
  config: {
    url: string;
    method: string;
    targetRps: number;
    durationSeconds: number;
    profile?: LoadProfile;
  };
  stop: () => Promise<void>;
  snapshot: () => Promise<number>;
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


// Sayfa çalışan teste yeniden bağlanırken çağrılır: tampondaki sonuçları veritabanına yazar ve canlı yayında
// o ana kadar gönderilmiş dilim sayısını döndürür. O dilimler veritabanından, sonrakiler canlı akıştan gelir.
// Test çalışmıyorsa (ya da başka bir testse) null.
export async function snapshotActiveTest(testRunId: string): Promise<number | null> {
  if (!activeRun || activeRun.testRunId !== testRunId) return null;
  return activeRun.snapshot();
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
    let windowLagMs = 0; // Bu dilimdeki en yüksek gecikme
    let lastLagMs = 0; // Son ölçülen gecikme (boş dilimlerde gösterge bunu göstermeye devam eder)
    let maxLagMs = 0; // Test boyunca en yüksek gecikme (veritabanına yazılır)
    let finalized = false;

    // Canlı dilimler: sonuçlar kendi zamanlarına göre testin başlangıcından itibaren 200 ms'lik dilimlere yerleşir
    // (detay sayfası ve analizle aynı). Sıradaki gönderilecek dilim nextWindow.
    const liveWindows = new Map<number, ResultItem[]>();
    let nextWindow = 0;

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

    // Başlangıç anı da sonuçlarla aynı sırayla yazılır (özet ve analiz bunu kullanır)
    function saveStartedAt(startedAt: number) {
      writeChain = writeChain
        .then(() =>
          prisma.testRun
            .update({ where: { id: params.testRunId }, data: { startedAt: new Date(startedAt) } })
            .then(() => undefined)
        )
        .catch((err) => {
          console.error("Başlangıç anı kaydedilemedi:", err);
        });
    }

    // --- Canlı yayın ---

    // Sonucu ait olduğu dilime koy. Dilimi zaten gönderilmiş çok geç bir sonuç, sıradaki dilime eklenir (kaybolmasın).
    function addToLive(items: ResultItem[]) {
      if (testStartTime === null) return;
      for (const item of items) {
        const index = Math.max(nextWindow, Math.floor((item.timestamp - testStartTime) / LIVE_WINDOW_MS));
        const list = liveWindows.get(index);
        if (list) list.push(item);
        else liveWindows.set(index, [item]);
      }
    }

    // Bir dilimi gönder. Zamanı dilimin sonu (0–0,2 arası → 0,2). Boş dilim de gönderilir: grafik düzgün ilerler.
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

    // Süresi dolmuş dilimleri sırayla gönder. final: test bitti, elde ne varsa gönder.
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

    // Canlı dilim zamanlayıcısı: testin başlangıcına hizalı. Her dilim bittikten LIVE_EMIT_DELAY_MS sonra
    // çalışır ve tam bir dilim gönderir. (Hizasız bir setInterval, dilim sınırına yakın denk gelince
    // bazen 0, bazen 2 dilim gönderip grafiği sarsıyordu.) Gecikirse kaçırdıklarını bir sonraki seferde gönderir.
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

    // Test nasıl biterse bitsin (tamamlandı, durduruldu, hata) buradan geçer, sadece bir kez çalışır
    async function finalize(status: FinalStatus, error?: ApiError) {
      if (finalized) return;
      finalized = true;

      clearInterval(flushInterval);
      if (liveTimer) clearTimeout(liveTimer);
      await worker.terminate();

      // Tamponda kalanları yaz, bekleyen yazmaların bitmesini bekle
      if (dbBuffer.length > 0) {
        writeToDb(dbBuffer);
        dbBuffer = [];
      }
      await writeChain;

      emitReadyWindows(true);

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
      // Gönderilmiş dilimlerin bütün sonuçları şu an ya tamponda ya veritabanında: tamponu yaz, sınırı döndür
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
      // Testin başlangıç anı: canlı dilimler buradan sayılır, veritabanına da yazılır
      if (message.type === "started") {
        testStartTime = message.startedAt;
        saveStartedAt(message.startedAt);
        scheduleLiveTick();
      }

      if (message.type === "batch") {
        // "started" mesajı her zaman önce gelir; gelmediyse (beklenmez) ilk paketin anı
        if (testStartTime === null) {
          testStartTime = Date.now();
          scheduleLiveTick();
        }
        dbBuffer.push(...message.results);
        addToLive(message.results);

        const lagMs = message.lagMs ?? 0;
        windowLagMs = Math.max(windowLagMs, lagMs);
        lastLagMs = lagMs;

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