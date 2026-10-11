// testRun.ts
// Test adresleri: isteği al, ilgili servisi çağır, cevabı gönder.
// Doğrulama → services/startRequest.ts, hesaplamalar → services/resultQueries.ts
// Hatalar { error, code, params } biçiminde gönderilir (errors.ts).

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

  // Test başlat
  testRunRouter.post("/", async (req, res) => {
    const validation = validateStartRequest(req.body);
    if (!validation.ok) {
      return res.status(400).json(errorBody(validation.error));
    }
    const input = validation.value;

    // Kilit, veritabanına ve güvenlik kontrolüne dokunmadan ÖNCE alınır (yarışı önler)
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
        console.error(`Test ${testRunId} başlatılamadı:`, err.message);
      });

      started = true;
      res.status(201).json({ testRunId });
    } catch (err) {
      console.error("Test başlatılamadı:", err);
      res.status(500).json(errorBody(apiError("START_FAILED")));
    } finally {
      // Test başlamadıysa kilidi bırak
      if (!started) releaseTestSlot();
    }
  });

  // Testi durdur
  testRunRouter.post("/:id/stop", (req, res) => {
    const stopped = stopTestRun(req.params.id);

    if (!stopped) {
      return res.status(404).json(errorBody(apiError("NO_ACTIVE_TEST")));
    }

    res.json({ stopping: true });
  });

  // Şu an çalışan test (sayfa yenilenince yeniden bağlanmak için).
  // /:id/... adreslerinden önce tanımlanmalı, "active" bir test kimliği sanılmasın.
  testRunRouter.get("/active", (req, res) => {
    res.json({ active: getActiveTestRun() });
  });

  // Geçmiş listesi: ?page=2&pageSize=20&method=GET&search=products&sort=newest
  testRunRouter.get("/", async (req, res) => {
    const query = parseListQuery(req.query as Record<string, unknown>);
    res.json(await listTestRuns(query));
  });

  // Bir testin o ana kadarki verisi, canlı akışla aynı biçimde
  testRunRouter.get("/:id/live", async (req, res) => {
    const windows = await getLiveWindows(req.params.id);
    if (!windows) {
      return res.status(404).json(errorBody(apiError("TEST_NOT_FOUND")));
    }

    res.json({ windows });
  });

  // Otomatik analiz: durum, kapasite, kademe tablosu, olaylar, öneriler
  testRunRouter.get("/:id/analysis", async (req, res) => {
    const analysis = await analyzeTestRun(req.params.id);
    if (!analysis) {
      return res.status(404).json(errorBody(apiError("TEST_NOT_FOUND")));
    }

    res.json(analysis);
  });

  // Detay sayfası: testin kaydı ve özeti (grafik verisi /:id/live'dan gelir)
  testRunRouter.get("/:id", async (req, res) => {
    const detail = await getTestDetail(req.params.id);
    if (!detail) {
      return res.status(404).json(errorBody(apiError("TEST_NOT_FOUND")));
    }

    res.json(detail);
  });

  // Tüm testleri sil (veritabanı temizleme)
  testRunRouter.delete("/", async (req, res) => {
    const result = await clearAllTestRuns();
    if (!result.ok) {
      return res.status(409).json(errorBody(apiError("TEST_ALREADY_RUNNING")));
    }

    res.json({ deletedRuns: result.deletedRuns, deletedResults: result.deletedResults });
  });

  // Tek bir testi sil
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