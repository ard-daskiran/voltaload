// Ham sonuçlardan saniyelik özet: her saniye için istek sayıları, hata türleri ve sıralı gecikmeler.
// Saniyeler testin başlangıcından sayılır (grafik ve özetle aynı başlangıç).
// Hiç cevap gelmeyen saniyeler de listede yer alır (sunucu kilitlenmiş olabilir).

import { isLatencySample, isServerError, isConnectionError, percentileOf } from "../engine/windowStats.js";
import { requestsBetween, type LoadProfile } from "../engine/scheduler.js";

export interface ResultRow {
  timestamp: Date;
  statusCode: number;
  errorType: string | null;
  responseTime: number;
}

export interface SecondStats {
  index: number; // 0 → 0–1 sn arası
  targetRps: number; // O saniyede gönderilmesi gereken istek sayısı (zamanlayıcıyla aynı hesap)
  inTest: boolean; // Test süresinin içinde mi? (sonrası: yolda kalan isteklerin cevapları)
  total: number;
  success: number; // Sunucu hatası olmayanlar (4xx dahil)
  serverErrors: number; // 5xx + cevapsız
  connectionErrors: number; // Reddedildi, koptu, ağ hatası
  timeouts: number;
  statusCounts: Record<string, number>;
  latencies: number[]; // Sıralı (bağlantı hataları hariç)
}

// Yüzdelik: özet ve canlı dilimlerle aynı hesap (windowStats.ts)
export function percentile(sorted: number[], p: number): number | null {
  return percentileOf(sorted, p);
}

// Ortanca: tek bir sıçrama ortalamayı bozar, ortancayı bozmaz
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface BuildOptions {
  origin: number; // Saniyelerin sayıldığı an (testin başlangıcı, ms)
  configuredDuration: number; // Testin ayarlanan süresi (hedef RPS hesabı için)
  effectiveDuration: number; // Analize girecek süre (durdurulan testlerde daha kısa)
  targetRps: number;
  profile: LoadProfile;
}

export function buildSeconds(rows: ResultRow[], options: BuildOptions): SecondStats[] {
  if (rows.length === 0) return [];

  const { configuredDuration, effectiveDuration, targetRps, profile, origin } = options;

  const createSecond = (index: number): SecondStats => ({
    index,
    targetRps: index < configuredDuration ? requestsBetween(index, index + 1, targetRps, configuredDuration, profile) : 0,
    inTest: index < effectiveDuration,
    total: 0,
    success: 0,
    serverErrors: 0,
    connectionErrors: 0,
    timeouts: 0,
    statusCounts: {},
    latencies: [],
  });

  const byIndex = new Map<number, SecondStats>();
  let lastIndex = 0;

  for (const row of rows) {
    const index = Math.max(0, Math.floor((row.timestamp.getTime() - origin) / 1000));
    lastIndex = Math.max(lastIndex, index);

    let second = byIndex.get(index);
    if (!second) {
      second = createSecond(index);
      byIndex.set(index, second);
    }

    second.total++;
    const key = row.errorType ?? String(row.statusCode);
    second.statusCounts[key] = (second.statusCounts[key] || 0) + 1;

    if (isServerError(row)) second.serverErrors++;
    else second.success++;

    if (isConnectionError(row)) second.connectionErrors++;
    if (row.errorType === "TIMEOUT") second.timeouts++;
    if (isLatencySample(row)) second.latencies.push(row.responseTime);
  }

  // Boş saniyeler dahil kesintisiz liste
  const last = Math.max(lastIndex, effectiveDuration - 1);
  const seconds: SecondStats[] = [];
  for (let i = 0; i <= last; i++) {
    const second = byIndex.get(i) ?? createSecond(i);
    second.latencies.sort((a, b) => a - b);
    seconds.push(second);
  }

  return seconds;
}