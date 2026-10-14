// recommendations.ts
// Öneriler: hangi durumda ne yapılmalı. Arayüz her türün cümlesini sözlükten kurar.
// Sonuçlar yanıltıcıysa (cevapların çoğu yönlendirme / 4xx / 429, neredeyse hepsi zaman aşımı
// ya da isteklerin çoğu bağlantı hatası) kapasite önerileri çıkmaz: o durumda sunucunun gerçek
// kapasitesi hakkında bir şey söylenemez. Kararlı ama yavaş sunucuda da çıkmaz: sorun yük değil,
// isteğin kendisi; yükle oynamak onu hızlandırmaz.

import { THRESHOLDS as T } from "./thresholds.js";
import type { GroupStats } from "./classify.js";
import type { Verdict } from "./verdict.js";
import { MAX_TARGET_RPS } from "../config.js";

// Önerilen takip testi (arayüzde "Bu testi çalıştır" ile başlatılabilir)
interface FollowUpTest {
  loadProfile: "STEPPED";
  targetRps: number;
  stepCount: number;
  duration: number;
}

export type Recommendation =
  | { type: "overload"; codes: string[] }
  | { type: "timeouts" }
  | { type: "tooSlow" }
  | { type: "serverErrors"; codes: string[] }
  | { type: "connection" }
  | { type: "tailLatency"; p95: number; p99: number }
  | { type: "clientErrors"; share: number }
  | { type: "redirects"; share: number; codes: string[] }
  | { type: "rateLimited" }
  | { type: "slowButStable"; p95: number }
  | { type: "narrowCapacity"; from: number; to: number; test: FollowUpTest }
  | { type: "findCapacity"; rps: number; test: FollowUpTest }
  | { type: "nearLimit"; rps: number; test: FollowUpTest }
  | { type: "noLimitFound"; rps: number; test: FollowUpTest | null }
  | { type: "lowSample" };

function followUp(targetRps: number): FollowUpTest {
  return {
    loadProfile: "STEPPED",
    targetRps: Math.min(MAX_TARGET_RPS, Math.max(T.followUp.stepCount, Math.round(targetRps))),
    stepCount: T.followUp.stepCount,
    duration: T.followUp.durationSeconds,
  };
}

const REDIRECT_CODES = ["301", "302", "303", "307", "308"];

export function buildRecommendations(totals: GroupStats, verdict: Verdict): Recommendation[] {
  const list: Recommendation[] = [];
  if (totals.total === 0) return list;

  const share = (codes: string[]) => codes.reduce((sum, c) => sum + (totals.statusCounts[c] ?? 0), 0) / totals.total;
  const present = (codes: string[]) => codes.filter((c) => (totals.statusCounts[c] ?? 0) / totals.total >= T.recommend.codeShare);
  const codes = Object.keys(totals.statusCounts);

  // Hız sınırlayıcı: cevapların çoğu 429 ise test, sunucunun kapasitesini değil sınırlayıcının ayarını ölçtü
  const rateLimited = share(["429"]) >= T.recommend.rateLimitedShare;

  // Sunucu kendini koruyor: aşırı yük (503) ya da hız sınırlayıcı (429).
  // 429 çoğunluktaysa "aşırı yük" denmez, aşağıda kendi uyarısı var.
  const overloadCodes = present(rateLimited ? ["503"] : ["429", "503"]);
  if (overloadCodes.length > 0) list.push({ type: "overload", codes: overloadCodes });

  // Zaman aşımı: neredeyse hepsiyse sorun yük değil, isteğin kendisi
  const timeoutShare = totals.timeouts / totals.total;
  const tooSlow = timeoutShare >= T.recommend.timeoutDominantShare;
  if (tooSlow) list.push({ type: "tooSlow" });
  else if (timeoutShare >= T.recommend.codeShare) list.push({ type: "timeouts" });

  // Uygulama hataları (503 hariç 5xx)
  const appErrors = present(codes.filter((c) => Number(c) >= 500 && c !== "503"));
  if (appErrors.length > 0) list.push({ type: "serverErrors", codes: appErrors.sort() });

  if (totals.connectionErrorRate >= T.connectionErrorRate) list.push({ type: "connection" });
  const connectionDominant = totals.connectionErrorRate >= T.recommend.connectionDominantShare;

  // Çoğu istek hızlı, arada çok yavaş olanlar var (fark hem oran hem milisaniye olarak belirgin olmalı)
  if (
    totals.p95 !== null &&
    totals.p99 !== null &&
    totals.errorRate < T.errorRate.borderline &&
    totals.p99 >= totals.p95 * T.recommend.tailRatio &&
    totals.p99 - totals.p95 >= T.recommend.tailMinExtraMs
  ) {
    list.push({ type: "tailLatency", p95: totals.p95, p99: totals.p99 });
  }

  // Test ayarlarıyla ilgili uyarılar (429 hariç: onu sunucu bilinçli olarak döndürüyor, kendi uyarısı var)
  const clientShare = share(codes.filter((c) => Number(c) >= 400 && Number(c) < 500 && c !== "429"));
  const clientMajority = clientShare >= T.recommend.clientErrorShare;
  if (clientMajority) list.push({ type: "clientErrors", share: clientShare });

  const redirectCodes = codes.filter((c) => REDIRECT_CODES.includes(c)).sort();
  const redirectShare = share(redirectCodes);
  const redirectMajority = redirectShare >= T.recommend.redirectShare;
  if (redirectMajority) list.push({ type: "redirects", share: redirectShare, codes: redirectCodes });

  if (rateLimited) list.push({ type: "rateLimited" });

  if (verdict.slowButStable && totals.p95 !== null) list.push({ type: "slowButStable", p95: totals.p95 });

  // Kapasiteyle ilgili sonraki adım (sonuçlar yanıltıcı değilse)
  const misleading =
    clientMajority || redirectMajority || rateLimited || tooSlow || connectionDominant || verdict.slowButStable;
  if (!misleading) {
    const c = verdict.capacity;
    if (c.kind === "approx") {
      list.push({ type: "narrowCapacity", from: c.rps, to: c.breakAt, test: followUp(c.breakAt) });
    } else if (c.kind === "below") {
      list.push({ type: "findCapacity", rps: c.rps, test: followUp(c.rps) });
    } else if (verdict.state !== "HEALTHY") {
      // Kapasiteye sayıldı ama gecikme arttı ("Sınırda"): "rahat kaldırdı" denmez, sınır yakında olabilir
      list.push({ type: "nearLimit", rps: c.rps, test: followUp(c.rps * T.followUp.nearLimitFactor) });
    } else {
      // Sınır görülmedi: Volta'nın üst sınırına ulaşıldıysa önerilecek test yok
      list.push({ type: "noLimitFound", rps: c.rps, test: c.rps >= MAX_TARGET_RPS ? null : followUp(c.rps * 2) });
    }
  }

  if (totals.targetRps < T.recommend.lowRps) list.push({ type: "lowSample" });

  return list;
}