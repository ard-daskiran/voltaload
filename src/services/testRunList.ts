// Geçmiş listesi: sayfalama, yöntem filtresi, arama ve sıralama.
// Sadece TestRun tablosunu okur, sonuç satırlarına dokunmaz.
// Arama URL'de ve rehberdeki isimlerde yapılır. Kayıtlı URL'lere isim eklenir (targetName).

import { prisma } from "../db/prisma.js";
import { serializeRun } from "./testRunFormat.js";
import { targetNamesFor, urlsMatchingName } from "./savedTargets.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 200;

export interface ListQuery {
  page: number;
  pageSize: number;
  method: "GET" | "POST" | null;
  search: string;
  sort: "newest" | "oldest";
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

// Adres parametrelerini güvenli değerlere çevirir. Geçersiz değerler varsayılana düşer, hata verilmez.
export function parseListQuery(query: Record<string, unknown>): ListQuery {
  return {
    page: toPositiveInt(query.page, 1),
    pageSize: Math.min(MAX_PAGE_SIZE, toPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE)),
    method: query.method === "GET" || query.method === "POST" ? query.method : null,
    search: typeof query.search === "string" ? query.search.trim().slice(0, MAX_SEARCH_LENGTH) : "",
    sort: query.sort === "oldest" ? "oldest" : "newest",
  };
}

export async function listTestRuns(q: ListQuery) {
  // Aranan metin bir kaydın isminde geçiyorsa o kaydın URL'sindeki testler de bulunsun
  const urlsByName = q.search ? await urlsMatchingName(q.search) : [];

  const where = {
    ...(q.method ? { method: q.method } : {}),
    ...(q.search
      ? {
          OR: [
            { url: { contains: q.search } },
            ...(urlsByName.length > 0 ? [{ url: { in: urlsByName } }] : []),
          ],
        }
      : {}),
  };

  // Toplam sayı ve o sayfanın kayıtları tek seferde
  const [total, runs] = await prisma.$transaction([
    prisma.testRun.count({ where }),
    prisma.testRun.findMany({
      where,
      orderBy: { createdAt: q.sort === "oldest" ? "asc" : "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  const names = await targetNamesFor(runs.map((run) => run.url));

  return {
    items: runs.map((run) => ({ ...serializeRun(run), targetName: names.get(run.url) ?? null })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}