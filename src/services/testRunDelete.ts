// Test silme ve veritabanı temizleme. Çalışan bir teste dokunulmaz.
// Sadece TestRun ve TestResult tabloları etkilenir (ileride eklenecek kayıtlı URL'ler ayrı tabloda kalır).

import { prisma } from "../db/prisma.js";
import { getActiveTestRun } from "../engine/testRunManager.js";

function isRunning(id: string, status: string): boolean {
  return status === "RUNNING" || getActiveTestRun()?.testRunId === id;
}

// Tek bir testi ve sonuçlarını sil. Ya ikisi birden silinir ya hiçbiri.
export async function deleteTestRun(id: string): Promise<{ ok: true } | { ok: false; reason: "notFound" | "running" }> {
  const run = await prisma.testRun.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!run) return { ok: false, reason: "notFound" };
  if (isRunning(run.id, run.status)) return { ok: false, reason: "running" };

  await prisma.$transaction([
    prisma.testResult.deleteMany({ where: { testRunId: id } }),
    prisma.testRun.delete({ where: { id } }),
  ]);

  return { ok: true };
}

// Tüm testleri ve sonuçlarını sil, sonra veritabanı dosyasını küçült.
export async function clearAllTestRuns(): Promise<
  { ok: true; deletedRuns: number; deletedResults: number } | { ok: false; reason: "running" }
> {
  if (getActiveTestRun()) return { ok: false, reason: "running" };

  const [results, runs] = await prisma.$transaction([
    prisma.testResult.deleteMany({}),
    prisma.testRun.deleteMany({}),
  ]);

  // SQLite silinen kayıtların yerini dosyada boş tutar. VACUUM dosyayı gerçekten küçültür.
  // Başarısız olursa veriler yine de silinmiştir, sadece dosya küçülmemiştir.
  try {
    await prisma.$executeRawUnsafe("VACUUM");
  } catch (err) {
    console.error("VACUUM çalıştırılamadı:", err);
  }

  return { ok: true, deletedRuns: runs.count, deletedResults: results.count };
}