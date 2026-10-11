import dns from "node:dns/promises";
import net from "node:net";
import os from "node:os";
import { VOLTA_PORT, CONNECT_CHECK_TIMEOUT_MS } from "../config.js";
import { apiError, type ApiError } from "../errors.js";

// --- İzin verilen adres aralıkları ---
// İsmi BlockList olsa da burada izin listesi olarak kullanıyoruz.

const loopbackRanges = new net.BlockList();
loopbackRanges.addSubnet("127.0.0.0", 8, "ipv4");
loopbackRanges.addAddress("::1", "ipv6");

const allowedRanges = new net.BlockList();
allowedRanges.addSubnet("127.0.0.0", 8, "ipv4");
allowedRanges.addSubnet("10.0.0.0", 8, "ipv4");
allowedRanges.addSubnet("172.16.0.0", 12, "ipv4");
allowedRanges.addSubnet("192.168.0.0", 16, "ipv4");
allowedRanges.addAddress("::1", "ipv6");
allowedRanges.addSubnet("fc00::", 7, "ipv6");

// --- Tipler ---

interface ResolvedTarget {
  url: string;
  hostname: string;
  address: string; // Bağlanılacak, onaylanmış IP
  family: 4 | 6;
  port: number;
}

export type SecurityResult =
  | { ok: true; target: ResolvedTarget }
  | { ok: false; error: ApiError };

interface Candidate {
  address: string;
  family: 4 | 6;
}

export type LocalUrlResult =
  | { ok: true; hostname: string; port: number; candidates: Candidate[] }
  | { ok: false; error: ApiError };

// --- Yardımcılar ---

// "::ffff:127.0.0.1" gibi IPv6 içine gömülü IPv4 adreslerini sade IPv4'e çevirir
function normalizeAddress(address: string, family: number): Candidate {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return { address: mapped[1], family: 4 };
  return { address, family: family === 6 ? 6 : 4 };
}

function isAllowedAddress(address: string, family: 4 | 6): boolean {
  return allowedRanges.check(address, family === 6 ? "ipv6" : "ipv4");
}

// Bu bilgisayarın kendi adresi mi? (loopback ya da ağ kartlarından biri)
function isOwnAddress(address: string, family: 4 | 6): boolean {
  if (loopbackRanges.check(address, family === 6 ? "ipv6" : "ipv4")) return true;

  const interfaces = os.networkInterfaces();
  for (const list of Object.values(interfaces)) {
    for (const info of list ?? []) {
      if (info.address === address) return true;
    }
  }
  return false;
}

// Adrese ve porta TCP bağlantısı kurulabiliyor mu? (HTTP isteği göndermez)
function canConnect(address: string, family: 4 | 6, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: address, port, family });

    const finish = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(CONNECT_CHECK_TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

// --- Adres kontrolü (bağlantı denemesi yok) ---
// URL geçerli mi, bütün adresleri yerel mi, Volta'nın kendisi mi?
// Hedef o an çalışmıyor olsa da sonuç verir. URL rehberi kayıt sırasında bunu kullanır.

export async function checkLocalUrl(rawUrl: string): Promise<LocalUrlResult> {
  // 1. URL geçerli mi?
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: apiError("URL_MALFORMED") };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: apiError("URL_PROTOCOL") };
  }

  // IPv6 adreslerinde URL köşeli parantez içerir: [::1]
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;

  if (hostname === "0.0.0.0" || hostname === "::") {
    return { ok: false, error: apiError("URL_UNSPECIFIED") };
  }

  // 2. Adres(ler)i çöz
  let candidates: Candidate[];

  if (net.isIP(hostname)) {
    candidates = [normalizeAddress(hostname, net.isIP(hostname))];
  } else {
    try {
      const results = await dns.lookup(hostname, { all: true });
      candidates = results.map((r) => normalizeAddress(r.address, r.family));
    } catch {
      return { ok: false, error: apiError("DNS_FAILED") };
    }
  }

  if (candidates.length === 0) {
    return { ok: false, error: apiError("DNS_FAILED") };
  }

  // 3. Bütün adresler yerel olmalı
  const allAllowed = candidates.every((c) => isAllowedAddress(c.address, c.family));
  if (!allAllowed) {
    return { ok: false, error: apiError("NOT_LOCAL") };
  }

  // 4. Volta'nın kendisine test atılamaz
  if (port === VOLTA_PORT && candidates.some((c) => isOwnAddress(c.address, c.family))) {
    return { ok: false, error: apiError("SELF_TARGET") };
  }

  return { ok: true, hostname, port, candidates };
}

// --- Test başlatma kontrolü ---
// Adres kontrolü + hedefe gerçekten bağlanılabiliyor mu? Bağlanılabilen ilk adresi seçer.

export async function resolveTarget(rawUrl: string): Promise<SecurityResult> {
  const check = await checkLocalUrl(rawUrl);
  if (!check.ok) return check;

  // 5. Bağlanılabilen ilk adresi seç (localhost hem IPv4 hem IPv6'ya çözülebilir)
  for (const candidate of check.candidates) {
    if (await canConnect(candidate.address, candidate.family, check.port)) {
      return {
        ok: true,
        target: {
          url: rawUrl,
          hostname: check.hostname,
          address: candidate.address,
          family: candidate.family,
          port: check.port,
        },
      };
    }
  }

  return { ok: false, error: apiError("TARGET_UNREACHABLE") };
}