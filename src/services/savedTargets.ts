// URL rehberi: kayıtlı hedefleri listeleme, ekleme, silme.
// Ayrıca geçmiş listesi ve detay sayfası için URL → isim eşleştirmesi.
// Eşleştirme URL'nin birebir aynısıyla yapılır (localhost ile 127.0.0.1 farklı sayılır).

import { prisma } from "../db/prisma.js";
import { checkLocalUrl } from "../engine/security.js";
import { apiError, type ApiError } from "../errors.js";
import { MAX_URL_LENGTH, MAX_SEARCH_LENGTH } from "../config.js";

const MAX_NAME_LENGTH = 40;

// İsmin karşılaştırma için küçük harfli hali ("Test Sunucusu" → "test sunucusu")
function nameKeyOf(name: string): string {
  return name.trim().toLocaleLowerCase("tr-TR");
}

export async function listSavedTargets(rawSearch: unknown) {
  const search = typeof rawSearch === "string" ? rawSearch.trim().slice(0, MAX_SEARCH_LENGTH) : "";

  return prisma.savedTarget.findMany({
    where: search
      ? { OR: [{ nameKey: { contains: nameKeyOf(search) } }, { url: { contains: search } }] }
      : undefined,
    orderBy: { nameKey: "asc" },
    select: { id: true, name: true, url: true, createdAt: true },
  });
}

type CreateResult =
  | { ok: true; target: { id: number; name: string; url: string } }
  | { ok: false; status: 400 | 409; error: ApiError };

export async function createSavedTarget(input: any): Promise<CreateResult> {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const url = typeof input?.url === "string" ? input.url.trim() : "";

  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return { ok: false, status: 400, error: apiError("TARGET_NAME_LENGTH", { max: MAX_NAME_LENGTH }) };
  }
  if (url.length === 0 || url.length > MAX_URL_LENGTH) {
    return { ok: false, status: 400, error: apiError("INVALID_URL") };
  }

  // Test başlatırkenki adres kontrolünün aynısı, ama hedefe bağlanmadan
  const check = await checkLocalUrl(url);
  if (!check.ok) return { ok: false, status: 400, error: check.error };

  const nameKey = nameKeyOf(name);

  const sameUrl = await prisma.savedTarget.findUnique({ where: { url } });
  if (sameUrl) {
    return { ok: false, status: 409, error: apiError("TARGET_URL_EXISTS", { name: sameUrl.name }) };
  }

  const sameName = await prisma.savedTarget.findUnique({ where: { nameKey } });
  if (sameName) {
    return { ok: false, status: 409, error: apiError("TARGET_NAME_EXISTS", { name: sameName.name }) };
  }

  try {
    const target = await prisma.savedTarget.create({
      data: { name, nameKey, url },
      select: { id: true, name: true, url: true },
    });
    return { ok: true, target };
  } catch (err: any) {
    // Aynı anda iki kayıt gelirse veritabanının benzersizlik kuralı yakalar
    if (err?.code === "P2002") return { ok: false, status: 409, error: apiError("TARGET_EXISTS") };
    throw err;
  }
}

export async function deleteSavedTarget(id: number): Promise<boolean> {
  const result = await prisma.savedTarget.deleteMany({ where: { id } });
  return result.count > 0;
}

// Verilen URL'lerden kayıtlı olanların isimleri (geçmiş listesi ve detay sayfası için)
export async function targetNamesFor(urls: string[]): Promise<Map<string, string>> {
  if (urls.length === 0) return new Map();

  const targets = await prisma.savedTarget.findMany({
    where: { url: { in: [...new Set(urls)] } },
    select: { url: true, name: true },
  });
  return new Map(targets.map((t) => [t.url, t.name]));
}

// İsmi aramayla eşleşen kayıtların URL'leri (geçmişte isimle arama için)
export async function urlsMatchingName(search: string): Promise<string[]> {
  if (!search) return [];

  const targets = await prisma.savedTarget.findMany({
    where: { nameKey: { contains: nameKeyOf(search) } },
    select: { url: true },
  });
  return targets.map((t) => t.url);
}

// Test bitince "rehbere kaydet" önerisi için: URL kayıtlı mı, kaç kez test edilmiş?
export async function suggestionFor(url: string) {
  const [saved, runCount] = await Promise.all([
    prisma.savedTarget.findUnique({ where: { url }, select: { id: true } }),
    prisma.testRun.count({ where: { url } }),
  ]);
  return { saved: saved !== null, runCount };
}