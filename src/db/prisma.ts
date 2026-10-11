import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

export const prisma = new PrismaClient({ adapter });

// WAL Mode 
prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch((err) => {
  console.error("WAL modu aktive edilemedi:", err);
});