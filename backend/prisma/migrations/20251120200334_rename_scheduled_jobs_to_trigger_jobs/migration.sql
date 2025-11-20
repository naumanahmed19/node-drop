-- Rename table from scheduled_jobs to trigger_jobs
ALTER TABLE "scheduled_jobs" RENAME TO "trigger_jobs";

-- Rename constraint
ALTER TABLE "trigger_jobs" RENAME CONSTRAINT "scheduled_jobs_pkey" TO "trigger_jobs_pkey";
ALTER TABLE "trigger_jobs" RENAME CONSTRAINT "scheduled_jobs_workflowId_fkey" TO "trigger_jobs_workflowId_fkey";

-- Rename indexes
ALTER INDEX "scheduled_jobs_jobKey_key" RENAME TO "trigger_jobs_jobKey_key";
ALTER INDEX "scheduled_jobs_workflowId_idx" RENAME TO "trigger_jobs_workflowId_idx";
ALTER INDEX "scheduled_jobs_active_idx" RENAME TO "trigger_jobs_active_idx";
ALTER INDEX "scheduled_jobs_workflowId_triggerId_key" RENAME TO "trigger_jobs_workflowId_triggerId_key";
ALTER INDEX "scheduled_jobs_type_idx" RENAME TO "trigger_jobs_type_idx";
