// Bir grup sonucun (canlı akışta 200ms'lik dilim) özeti.
// Hem canlı akış (testRunManager) hem de sayfa yenilenince doldurma (routes) bu fonksiyonu kullanır.

export interface ResultLike {
  statusCode: number;
  errorType: string | null;
  responseTime: number;
  responseSize: number;
}

// Gecikme hesaplarına girer mi? Cevap gelenler ve TIMEOUT'lar evet.
// Bağlantı hataları anında döner, gecikmeyi yapay olarak düşürür, hariç tutulur.
export function isLatencySample(r: { errorType: string | null }): boolean {
  return r.errorType === null || r.errorType === "TIMEOUT";
}

// Grafikte kırmızı yapan hatalar: cevap gelmeyen her istek + 5xx.
// 4xx dahil değil: hızlı dönen bir 401/404 sunucunun sağlıklı olduğunu gösterir.
export function isServerError(r: { statusCode: number; errorType: string | null }): boolean {
  return r.errorType !== null || r.statusCode >= 500;
}

// Bağlantı hatası: TIMEOUT dışındaki, cevap gelmeyen istekler
export function isConnectionError(r: { errorType: string | null }): boolean {
  return r.errorType !== null && r.errorType !== "TIMEOUT";
}

export function summarizeWindow(items: ResultLike[]) {
  const latencies = items
    .filter(isLatencySample)
    .map((r) => r.responseTime)
    .sort((a, b) => a - b);

  const statusCounts: Record<string, number> = {};
  let errorCount = 0;
  let successCount = 0;
  let connectionErrorCount = 0;
  let bytes = 0;

  for (const r of items) {
    const key = r.errorType ?? String(r.statusCode);
    statusCounts[key] = (statusCounts[key] || 0) + 1;

    if (isServerError(r)) errorCount++;
    else successCount++;

    if (isConnectionError(r)) connectionErrorCount++;
    bytes += r.responseSize;
  }

  const n = latencies.length;
  const hasLatency = n > 0;
  const percentileOf = (p: number) => latencies[Math.min(n - 1, Math.floor(n * p))];

  return {
    requestCount: items.length,
    successCount,
    latencyCount: n,
    avgResponseTime: hasLatency ? latencies.reduce((a, b) => a + b, 0) / n : null,
    minResponseTime: hasLatency ? latencies[0] : null,
    maxResponseTime: hasLatency ? latencies[n - 1] : null,
    p95ResponseTime: hasLatency ? percentileOf(0.95) : null,
    p99ResponseTime: hasLatency ? percentileOf(0.99) : null,
    statusCounts,
    errorCount,
    connectionErrorCount,
    bytes,
  };
}