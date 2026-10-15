// Summary of a group of results (a 200ms window in the live stream).
// Both the live stream (testRunManager) and the detail page / page reload (services/resultQueries) use this function.

export interface ResultLike {
  statusCode: number;
  errorType: string | null;
  responseTime: number;
  responseSize: number;
}

// Does it count toward latency? Responses that arrived and TIMEOUTs do.
// Connection errors return instantly and would artificially lower latency, so they're excluded.
export function isLatencySample(r: { errorType: string | null }): boolean {
  return r.errorType === null || r.errorType === "TIMEOUT";
}

// Errors shown in red on the chart: every request with no response + 5xx.
// 4xx isn't included: a fast 401/404 shows the server is healthy.
export function isServerError(r: { statusCode: number; errorType: string | null }): boolean {
  return r.errorType !== null || r.statusCode >= 500;
}

// Connection error: requests with no response, other than TIMEOUT
export function isConnectionError(r: { errorType: string | null }): boolean {
  return r.errorType !== null && r.errorType !== "TIMEOUT";
}

// Percentile ("nearest rank" definition): among n sorted values, the p value is the ⌈n × p⌉-th value.
// (With 100 values, p95 = the 95th value.) The summary, live windows and analysis use the same calculation.
export function percentileIndex(count: number, p: number): number {
  // Small margin: so products like 0.95 × 60 don't come out as 57.0000001 due to floating point and jump to the next rank
  return Math.min(count - 1, Math.max(0, Math.ceil(count * p - 1e-9) - 1));
}

export function percentileOf(sorted: number[], p: number): number | null {
  return sorted.length > 0 ? sorted[percentileIndex(sorted.length, p)] : null;
}

export function summarizeWindow(items: ResultLike[]) {
  const latencies = items
    .filter(isLatencySample)
    .map((r) => r.responseTime)
    .sort((a, b) => a - b);

  const statusCounts: Record<string, number> = {};
  let errorCount = 0;
  let successCount = 0;
  let bytes = 0;

  for (const r of items) {
    const key = r.errorType ?? String(r.statusCode);
    statusCounts[key] = (statusCounts[key] || 0) + 1;

    if (isServerError(r)) errorCount++;
    else successCount++;

    bytes += r.responseSize;
  }

  const n = latencies.length;
  const hasLatency = n > 0;

  return {
    requestCount: items.length,
    successCount,
    latencyCount: n,
    avgResponseTime: hasLatency ? latencies.reduce((a, b) => a + b, 0) / n : null,
    minResponseTime: hasLatency ? latencies[0] : null,
    maxResponseTime: hasLatency ? latencies[n - 1] : null,
    p95ResponseTime: percentileOf(latencies, 0.95),
    p99ResponseTime: percentileOf(latencies, 0.99),
    statusCounts,
    errorCount,
    bytes,
  };
}