import path from "node:path";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Project folder (two levels above src/db or the compiled dist/db)
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// Database address comes from DATABASE_URL in .env (same file as Prisma's CLI uses).
// Relative paths like "file:./prisma/dev.db" are resolved against the project folder, so Volta
// doesn't open a new, empty database when started from another folder.
function databaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:")) return url;

  const filePath = url.slice("file:".length);
  return path.isAbsolute(filePath) ? url : `file:${path.resolve(PROJECT_ROOT, filePath)}`;
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl() });

export const prisma = new PrismaClient({ adapter });

// WAL mode: reads don't wait while writing
prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch((err) => {
  console.error("Could not enable WAL mode:", err);
});