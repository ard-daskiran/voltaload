// resultsCsv.ts
// A test's results as CSV: one row per request, in the order they were sent.
// For a test with variables, the values of each request ({{email}}, {{password}}...) are computed again from its
// sequence number and the test's seed (engine/variables.ts); they were never saved.
// The column names are fixed and in English, so the file can be read back later (e.g. as user data for a scenario).

import { prisma } from "../db/prisma.js";
import { createValueGenerator, findVariables, isVariableName, VARIABLE_NAMES, type VariableName } from "../engine/variables.js";
import { parseHeaders } from "./testRunFormat.js";

// Rows are read in pages, so a 60,000-request test doesn't load everything at once
const PAGE_SIZE = 5000;

export type CsvSeparator = "," | ";";

// A cell is quoted only when it has to be: if it contains the separator, a quote or a line break
function cell(value: string | number | null, separator: CsvSeparator): string {
  if (value === null) return "";
  const text = String(value);
  return text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function buildResultsCsv(testRunId: string, separator: CsvSeparator) {
  const testRun = await prisma.testRun.findUnique({ where: { id: testRunId } });
  if (!testRun) return null;

  // Which variables the test used, in a fixed order (n has its own column whenever there are variables)
  const texts = [testRun.url, testRun.body ?? "", ...parseHeaders(testRun.headers).map((header) => header.value)];
  const used = new Set(texts.flatMap(findVariables).filter(isVariableName));
  const variableColumns = VARIABLE_NAMES.filter((name): name is Exclude<VariableName, "n"> => name !== "n" && used.has(name));

  const seed = testRun.variableSeed;
  const valuesFor = seed ? createValueGenerator({ testRunId, seed }, variableColumns) : null;

  const columns = [...(seed ? ["n", ...variableColumns] : []), "status", "error", "response_ms", "sent_at"];
  const lines = [columns.join(separator)];

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const rows = await prisma.testResult.findMany({
      where: { testRunId },
      // With variables: by sequence number (the order the requests were sent). Otherwise: the order they were saved.
      orderBy: seed ? [{ seq: "asc" }, { id: "asc" }] : { id: "asc" },
      skip,
      take: PAGE_SIZE,
      select: { seq: true, statusCode: true, errorType: true, responseTime: true, timestamp: true },
    });

    for (const row of rows) {
      const values = valuesFor && row.seq !== null ? valuesFor(row.seq) : null;
      const cells = [
        ...(seed ? [row.seq, ...variableColumns.map((name) => (values ? values[name] : null))] : []),
        // 0 means no response arrived; the error column says why
        row.statusCode === 0 ? null : row.statusCode,
        row.errorType,
        row.responseTime,
        // When the request was sent: the response time is subtracted from when it ended
        new Date(row.timestamp.getTime() - row.responseTime).toISOString(),
      ];
      lines.push(cells.map((value) => cell(value, separator)).join(separator));
    }

    if (rows.length < PAGE_SIZE) break;
  }

  return {
    filename: `volta-${testRunId.slice(0, 8)}-results.csv`,
    // The BOM at the start makes Excel read the file as UTF-8
    content: "﻿" + lines.join("\r\n") + "\r\n",
  };
}