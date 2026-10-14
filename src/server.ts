// .env her şeyden önce yüklenmeli: config.ts (VOLTA_PORT) ve db/prisma.ts (DATABASE_URL) onu okuyor
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
  validateConfig,
} from "./config.js";
import { createSavedTargetRouter } from "./routes/savedTargets.js";
import { apiError, errorBody } from "./errors.js";

// --- Güvenlik: istek Volta'nın kendi adresinden mi geliyor? ---
// Volta sadece bu bilgisayardan erişilebilir (127.0.0.1), ama tarayıcıda açık olan başka bir site
// tarayıcı üzerinden Volta'ya istek atmaya çalışabilir. Üç kontrol:
//   Host:   tarayıcı adres çubuğundaki adı yazar. "kotu-site.com:4400" gibi bir ad reddedilir (DNS rebinding).
//   Origin: isteği hangi sitenin gönderdiğini yazar. Durum değiştiren isteklerde ve canlı bağlantıda
//           sadece Volta'nın kendi sayfası kabul edilir. Origin yoksa (curl gibi tarayıcı dışı araçlar) izin verilir.
//   Çerçeve: Volta başka bir sitenin içinde (iframe) açılamaz (görünmez çerçeveyle tıklatma saldırısı).

// Port 80'de tarayıcı Host'a portu yazmaz, o yüzden portsuz hali de kabul edilir (adlar zaten sadece bu bilgisayarın)
const allowedHosts = new Set(ALLOWED_HOSTNAMES.flatMap((name) => [`${name}:${VOLTA_PORT}`, name]));
const allowedOrigins = new Set(ALLOWED_HOSTNAMES.map((name) => `http://${name}:${VOLTA_PORT}`));

function isAllowedHost(host: string | undefined): boolean {
  return host !== undefined && allowedHosts.has(host.toLowerCase());
}

function isAllowedOrigin(origin: string | undefined): boolean {
  return origin === undefined || allowedOrigins.has(origin.toLowerCase());
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Test kimlikleri UUID. Odaya katılırken başka bir şey gelirse yok sayılır.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- Uygulama ---

const app = express();

// Cevaplarda "X-Powered-By: Express" yazmasın (gereksiz bilgi)
app.disable("x-powered-by");

// Güvenlik kontrolü bütün isteklerden önce (sayfalar dahil)
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

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});


// Test sınırları: arayüz kendi kontrollerini, kutuların min/max değerlerini ve ipuçlarını buradan alır.
// Sınırlar sadece config.ts'te yazılı; değiştirince arayüz de kendiliğinden uyar.
app.get("/api/limits", (req, res) => {
  res.json({
    minTargetRps: MIN_TARGET_RPS,
    maxTargetRps: MAX_TARGET_RPS,
    minDurationSeconds: MIN_DURATION_SECONDS,
    maxDurationSeconds: MAX_DURATION_SECONDS,
    minStepCount: MIN_STEP_COUNT,
    maxStepCount: MAX_STEP_COUNT,
    minStepDurationSeconds: MIN_STEP_DURATION_SECONDS,
  });
});

const httpServer = createServer(app);

// Canlı bağlantı: Express'in kontrolünden geçmez (Socket.io kendi adresini kendisi karşılar), aynı kontrol burada.
// Tarayıcılar WebSocket'te CORS kuralını uygulamadığı için Origin kontrolü özellikle önemli.
const io = new Server(httpServer, {
  allowRequest: (req, callback) => {
    callback(null, isAllowedHost(req.headers.host) && isAllowedOrigin(req.headers.origin));
  },
});

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

  socket.on("join-test", (testRunId: unknown) => {
    // Sadece test kimliği biçimindeki değerler (rastgele ya da çok uzun değerler yok sayılır, terminale de yazılmaz)
    if (typeof testRunId !== "string" || !UUID_PATTERN.test(testRunId)) return;
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
  // Önce ayarlar: geçersiz bir değerle (0 saniyelik test, yanlış port...) açılmasın, ne yanlış olduğunu söylesin
  const problems = validateConfig();
  if (problems.length > 0) {
    console.error("Volta could not start: invalid settings in src/config.ts.");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("Fix them and restart Volta.");
    process.exit(1);
  }

  await markInterruptedRuns();

  httpServer.listen(VOLTA_PORT, VOLTA_HOST, () => {
    console.log(`Volta sunucusu http://localhost:${VOLTA_PORT} adresinde çalışıyor.`);
  });
}

main().catch((err) => {
  console.error("Volta başlatılamadı:", err);
  process.exit(1);
});