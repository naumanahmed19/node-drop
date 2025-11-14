-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRun" TIMESTAMP(3),
    "nextRun" TIMESTAMP(3),
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_jobKey_key" ON "scheduled_jobs"("jobKey");

-- CreateIndex
CREATE INDEX "scheduled_jobs_workflowId_idx" ON "scheduled_jobs"("workflowId");

-- CreateIndex
CREATE INDEX "scheduled_jobs_active_idx" ON "scheduled_jobs"("active");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_workflowId_triggerId_key" ON "scheduled_jobs"("workflowId", "triggerId");

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
