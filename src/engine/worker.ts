import { parentPort } from "node:worker_threads";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { Agent, request } from "undici";
import { runScheduledLoop, type LoadProfile } from "./scheduler.js";
import { WORKER_BATCH_INTERVAL_MS } from "../config.js";

if (!parentPort) {
  throw new Error("Bu dosya sadece bir worker thread içinde çalıştırılmalı.");
}

const port = parentPort;

const REQUEST_TIMEOUT_MS = 2500;


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
  statusCode: number; // Cevap gelmediyse 0
  errorType: ErrorType | null;
  responseTime: number; // ms
  responseSize: number; // byte (ağdan inen, sıkıştırılmış)
  timestamp: number; // cevabın tamamlandığı an (ms)
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
        // Tarayıcı gibi sıkıştırılmış cevap iste. undici cevabı açmaz.
        "accept-encoding": "gzip, deflate, br",
        ...(sendsBody ? { "content-type": "application/json" } : {}),
      },
      signal,
    });

    // İçeriğin tamamını oku ama saklama: sadece boyutunu say.
    // Böylece süre gerçekçi ölçülür ve bağlantı tekrar kullanılabilir.
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
    // Hata türünü hata nesnesinin adından değil, kendi zamanlayıcımızdan anla
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

  // DNS pinning: her bağlantı, ana thread'in onayladığı adrese gider.
  // Node adres sorgusunu iki biçimde yapabilir (tek adres ya da liste), ikisine de cevap veriyoruz.
  const agent = new Agent({
    connect: {
      // Sertifika doğrulaması kapalı: yerel HTTPS sunucuları neredeyse hep kendinden imzalı sertifika kullanır
      // (mkcert, Vite --https gibi), doğrulama açıkken bütün istekler "ağ hatası" olur. Hedefler zaten sadece
      // yerel adresler (security.ts); curl -k ve Postman'in "SSL doğrulama" ayarı da aynısını yapar.
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

  // Worker'ın kendi gecikmesi (Volta'nın kendisi yetişebiliyor mu?)
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

  // Sayıya göre değil, zamana göre gönder: sunucu yavaşlasa da grafik akmaya devam eder
  const flushTimer = setInterval(flush, WORKER_BATCH_INTERVAL_MS);

  const inFlight = new Set<Promise<void>>();

  // Testin başlangıç anı: zamanlayıcının sıfır noktası (ilk istek bu anda gider).
  // Analiz, özet ve grafik saniyeleri buradan sayar.
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

  // Süre doldu: yoldaki isteklerin bitmesini bekle (en fazla timeout kadar)
  await Promise.allSettled([...inFlight]);

  clearInterval(flushTimer);
  flush();
  loopDelay.disable();

  await agent.close();
  port.postMessage({ type: "done" });
});