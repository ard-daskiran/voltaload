import dns from "node:dns/promises";
import net from "node:net";
import os from "node:os";
import { VOLTA_PORT, CONNECT_CHECK_TIMEOUT_MS } from "../config.js";
import { apiError, type ApiError } from "../errors.js";

// --- Allowed address ranges ---
// Despite the name BlockList, we use it as an allow list here.

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

// --- Types ---

interface ResolvedTarget {
  address: string; // Approved IP to connect to (the worker connects only to this)
  family: 4 | 6;
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

// --- Helpers ---

// Converts IPv4 addresses embedded in IPv6 to plain IPv4. Recognizes both notations:
//   "::ffff:172.20.10.4" (dotted; seen in DNS answers)
//   "::ffff:ac14:a04"    (hex; an address from a URL is always in this form, the parser converts it)
// This way the address rules and the "Volta's own address" check give the same result for both notations.
function normalizeAddress(address: string, family: number): Candidate {
  const dotted = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (dotted) return { address: dotted[1], family: 4 };

  const hex = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);
    const ipv4 = [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
    return { address: ipv4, family: 4 };
  }

  return { address, family: family === 6 ? 6 : 4 };
}

function isAllowedAddress(address: string, family: 4 | 6): boolean {
  return allowedRanges.check(address, family === 6 ? "ipv6" : "ipv4");
}

// Is it this computer's own address? (loopback or one of the network interfaces)
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

// Can a TCP connection be opened to the address and port? (doesn't send an HTTP request)
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

// --- Address check (no connection attempt) ---
// Is the URL valid, are all its addresses local, is it Volta itself?
// Gives a result even if the target isn't running right now. The target book uses this when saving.

export async function checkLocalUrl(rawUrl: string): Promise<LocalUrlResult> {
  // 1. Is the URL valid?
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: apiError("URL_MALFORMED") };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: apiError("URL_PROTOCOL") };
  }

  // For IPv6 addresses the URL contains square brackets: [::1]
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;

  if (hostname === "0.0.0.0" || hostname === "::") {
    return { ok: false, error: apiError("URL_UNSPECIFIED") };
  }

  // 2. Resolve the address(es)
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

  // 3. All addresses must be local
  const allAllowed = candidates.every((c) => isAllowedAddress(c.address, c.family));
  if (!allAllowed) {
    return { ok: false, error: apiError("NOT_LOCAL") };
  }

  // 4. Volta can't test itself
  if (port === VOLTA_PORT && candidates.some((c) => isOwnAddress(c.address, c.family))) {
    return { ok: false, error: apiError("SELF_TARGET") };
  }

  return { ok: true, hostname, port, candidates };
}

// --- Test start check ---
// Address check + can we actually connect to the target? Picks the first address that connects.

export async function resolveTarget(rawUrl: string): Promise<SecurityResult> {
  const check = await checkLocalUrl(rawUrl);
  if (!check.ok) return check;

  // 5. Pick the first address that connects (localhost may resolve to both IPv4 and IPv6)
  for (const candidate of check.candidates) {
    if (await canConnect(candidate.address, candidate.family, check.port)) {
      return { ok: true, target: { address: candidate.address, family: candidate.family } };
    }
  }

  return { ok: false, error: apiError("TARGET_UNREACHABLE") };
}