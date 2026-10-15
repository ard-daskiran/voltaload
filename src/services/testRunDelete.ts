// Test deletion and database clearing. A running test is never touched.
// Only the TestRun and TestResult tables are affected (the target book is in a separate table and isn't touched).

import { prisma } from "../db/prisma.js";
import { getActiveTestRun } from "../engine/testRunManager.js";

function isRunning(id: string, status: string): boolean {
  return status === "RUNNING" || getActiveTestRun()?.testRunId === id;
}

// Delete a single test and its results. Either both are deleted or neither.
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

// Delete all tests and their results, then shrink the database file.
export async function clearAllTestRuns(): Promise<
  { ok: true; deletedRuns: number; deletedResults: number } | { ok: false; reason: "running" }
> {
  if (getActiveTestRun()) return { ok: false, reason: "running" };

  const [results, runs] = await prisma.$transaction([
    prisma.testResult.deleteMany({}),
    prisma.testRun.deleteMany({}),
  ]);

  // SQLite keeps the space of deleted rows empty in the file. VACUUM actually shrinks the file.
  // If it fails, the data is still deleted; only the file hasn't shrunk.
  try {
    await prisma.$executeRawUnsafe("VACUUM");
    // In WAL mode changes are first written to dev.db-wal and that file doesn't shrink on its own:
    // move them into the main file and reset it, otherwise a file of tens of MB stays in the folder after clearing
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch (err) {
    console.error("Could not shrink the database file:", err);
  }

  return { ok: true, deletedRuns: runs.count, deletedResults: results.count };
}