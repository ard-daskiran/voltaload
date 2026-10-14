// seconds.ts
// Ham sonuçlardan saniyelik özet: her saniye için istek sayıları, hata türleri ve sıralı gecikmeler.
// Saniyeler testin başlangıcından sayılır. Her sonuç, isteğin GÖNDERİLDİĞİ saniyeye yazılır, cevabın geldiği
// saniyeye değil. Analizin sorusu "her saniye gönderilen yükü sunucu kaldırabildi mi?". Böylece cevabı geç gelen
// (örneğin her isteği 2 sn süren) sağlıklı bir sunucu, ilk saniyeleri boş görünüp "bağlantı koptu" sanılmaz.
// (Grafik ise cevapları geldikleri ana göre gösterir: "şu anda sunucudan ne geliyor?")
// Hiç sonucu olmayan saniyeler de listede yer alır (sunucu kilitlenmiş olabilir).

import { isLatencySample, isServerError, isConnectionError, percentileOf } from "../engine/windowStats.js";
import { requestsBetween, type LoadProfile } from "../engine/scheduler.js";

// Gönderilme anı (cevabın geldiği an − cevap süresi) milisaniyeye yuvarlanmış değerlerden hesaplanır, ±1,5 ms
// şaşabilir. Zamanlayıcı tam saniye sınırında da istek gönderdiği için (ilk istek 0. anda, sonra eşit aralıklarla)
// o istekler bir önceki saniyeye kaymasın diye küçük bir pay eklenir.
const SEND_TIME_TOLERANCE_MS = 2;

export interface ResultRow {
  timestamp: Date;
  statusCode: number;
  errorType: string | null;
  responseTime: number;
}

export interface SecondStats {
  index: number; // 0 → 0–1 sn arası
  span: number; // Saniyenin analize giren kısmı (1; durdurulan testin son saniyesinde kesirli olabilir)
  targetRps: number; // O saniyede (o kısımda) gönderilmesi gereken istek sayısı (zamanlayıcıyla aynı hesap)
  inTest: boolean; // Analiz edilen sürenin içinde mi?
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
  configuredDuration: number; // Testin ayarlanan süresi (hedef hesabı için)
  effectiveDuration: number; // Analize girecek süre (sn; durdurulan testte kesirli olabilir)
  targetRps: number;
  profile: LoadProfile;
}

export function buildSeconds(rows: ResultRow[], options: BuildOptions): SecondStats[] {
  if (rows.length === 0) return [];

  const { configuredDuration, effectiveDuration, targetRps, profile, origin } = options;

  // Analize giren son saniye
  const lastIndex = Math.max(0, Math.ceil(effectiveDuration) - 1);

  const createSecond = (index: number): SecondStats => {
    // Durdurulan testin son saniyesi kısmi olabilir: sadece durma anına kadar gönderilmesi gerekenler
    const end = Math.min(index + 1, effectiveDuration);
    return {
      index,
      span: end - index,
      targetRps: index < configuredDuration ? requestsBetween(index, end, targetRps, configuredDuration, profile) : 0,
      inTest: index < effectiveDuration,
      total: 0,
      success: 0,
      serverErrors: 0,
      connectionErrors: 0,
      timeouts: 0,
      statusCounts: {},
      latencies: [],
    };
  };

  const byIndex = new Map<number, SecondStats>();

  for (const row of rows) {
    // Gönderilme saniyesi. Analiz edilen sürenin dışında görünenler (zamanlayıcının son anda yetiştirdikleri,
    // yuvarlama) en yakın uca yazılır.
    const sentAt = row.timestamp.getTime() - row.responseTime;
    const raw = Math.floor((sentAt - origin + SEND_TIME_TOLERANCE_MS) / 1000);
    const index = Math.min(Math.max(0, raw), lastIndex);

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
  const seconds: SecondStats[] = [];
  for (let i = 0; i <= lastIndex; i++) {
    const second = byIndex.get(i) ?? createSecond(i);
    second.latencies.sort((a, b) => a - b);
    seconds.push(second);
  }

  return seconds;
}