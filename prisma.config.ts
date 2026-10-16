import "dotenv/config";
import { defineConfig } from "prisma/config";

// The database address comes from DATABASE_URL in .env. Without .env the default file is used
// (same default as src/db/prisma.ts), so Prisma's commands work on a fresh copy too.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});