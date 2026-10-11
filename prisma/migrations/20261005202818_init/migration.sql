-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "body" TEXT,
    "targetRps" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loadProfile" TEXT NOT NULL DEFAULT 'CONSTANT',
    "stepCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "finishedAt" DATETIME,
    "totalRequests" INTEGER,
    "avgResponseTime" REAL,
    "minResponseTime" INTEGER,
    "maxResponseTime" INTEGER,
    "p95" INTEGER,
    "p99" INTEGER,
    "stdDev" REAL,
    "serverErrorCount" INTEGER,
    "totalBytes" BIGINT,
    "actualDurationMs" INTEGER
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "testRunId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusCode" INTEGER NOT NULL,
    "errorType" TEXT,
    "responseTime" INTEGER NOT NULL,
    "responseSize" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TestResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TestResult_testRunId_idx" ON "TestResult"("testRunId");
