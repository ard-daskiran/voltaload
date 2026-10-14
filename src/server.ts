import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createTestRunRouter } from "./routes/testRun.js";
import { prisma } from "./db/prisma.js";
import { computeTestSummary } from "./engine/summary.js";
import { VOLTA_HOST, VOLTA_PORT } from "./config.js";
import { createSavedTargetRouter } from "./routes/savedTargets.js";
import { apiError, errorBody } from "./errors.js";

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);
export const io = new Server(httpServer);

app.use("/api/test-run", createTestRunRouter(io));
app.use("/api/targets", createSavedTargetRouter());


// /api altında bulunamayan adresler: Express'in HTML sayfası yerine JSON
app.use("/api", (req, res) => {
  res.status(404).json(errorBody(apiError("API_NOT_FOUND")));
});

// Hata yakalayıcı: gövde okunurken ya da bir rotada çıkan hatalar. En sonda olmalı (dört parametreli).
// Cevap her zaman { error, code } biçiminde; yığın izi ve dosya yolları kullanıcıya gönderilmez, terminale yazılır.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  if (err?.type === "entity.too.large") {
    return res.status(413).json(errorBody(apiError("BODY_TOO_LARGE", { max: "100 KB" })));
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json(errorBody(apiError("INVALID_JSON")));
  }

  console.error("Beklenmeyen sunucu hatası:", err);
  res.status(500).json(errorBody(apiError("INTERNAL_ERROR")));
});

io.on("connection", (socket) => {
  console.log("Bir tarayıcı bağlandı:", socket.id);

  socket.on("join-test", (testRunId: string) => {
    socket.join(testRunId);
    console.log(`Socket ${socket.id}, ${testRunId} odasına katıldı`);
  });

  socket.on("disconnect", () => {
    console.log("Tarayıcı bağlantısı koptu:", socket.id);
  });
});

// Volta test sırasında kapandıysa o testler RUNNING kalır.
// Açılışta bunları INTERRUPTED olarak işaretle ve eldeki verilerden özetlerini hesapla.
async function markInterruptedRuns() {
  const stuckRuns = await prisma.testRun.findMany({
    where: { status: "RUNNING" },
    select: { id: true, startedAt: true, createdAt: true },
  });

  for (const run of stuckRuns) {
    try {
      const summary = await computeTestSummary(run.id);

      // Bitiş anı: son kaydedilen sonuç. (Volta'nın yeniden açıldığı an değil; o saatler sonrası olabilir
      // ve analiz aradaki bütün saniyeleri "cevap gelmedi" sanıp sunucuyu suçlar.) Hiç sonuç yoksa başlangıç.
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
      console.error(`Test ${run.id} işaretlenemedi:`, err);
    }
  }

  if (stuckRuns.length > 0) {
    console.log(`${stuckRuns.length} yarıda kalmış test INTERRUPTED olarak işaretlendi.`);
  }
}

async function main() {
  await markInterruptedRuns();

  httpServer.listen(VOLTA_PORT, VOLTA_HOST, () => {
    console.log(`Volta sunucusu http://localhost:${VOLTA_PORT} adresinde çalışıyor.`);
  });
}

main().catch((err) => {
  console.error("Volta başlatılamadı:", err);
  process.exit(1);
});