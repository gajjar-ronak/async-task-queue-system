-- CreateTable
CREATE TABLE "dead_letter_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalTaskId" TEXT NOT NULL,
    "workflowId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL,
    "maxAttempts" INTEGER NOT NULL,
    "lastError" TEXT NOT NULL,
    "lastErrorStack" TEXT,
    "failureReason" TEXT,
    "originalCreatedAt" DATETIME NOT NULL,
    "firstFailedAt" DATETIME NOT NULL,
    "movedToDlqAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retryHistory" JSONB,
    "processingMetadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reprocessedAt" DATETIME,
    "reprocessedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "dead_letter_tasks_originalTaskId_key" ON "dead_letter_tasks"("originalTaskId");
