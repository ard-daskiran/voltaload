import path from "node:path";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Proje klasörü (src/db ya da derlenmiş dist/db'den iki üst)
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// Veritabanı adresi .env'deki DATABASE_URL'den (Prisma'nın komut satırı aracıyla aynı dosya).
// "file:./prisma/dev.db" gibi göreli yollar proje klasörüne göre çözülür: Volta başka bir klasörden
// başlatılırsa yeni, boş bir veritabanı açmasın.
function databaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:")) return url;

  const filePath = url.slice("file:".length);
  return path.isAbsolute(filePath) ? url : `file:${path.resolve(PROJECT_ROOT, filePath)}`;
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl() });

export const prisma = new PrismaClient({ adapter });

// WAL modu: yazarken okumalar beklemesin
prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch((err) => {
  console.error("WAL modu aktive edilemedi:", err);
});