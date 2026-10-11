-- CreateTable
CREATE TABLE "SavedTarget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedTarget_nameKey_key" ON "SavedTarget"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "SavedTarget_url_key" ON "SavedTarget"("url");
