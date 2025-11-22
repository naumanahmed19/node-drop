-- AlterTable
ALTER TABLE "scheduled_jobs" ADD COLUMN     "pollInterval" INTEGER,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'schedule',
ALTER COLUMN "cronExpression" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "scheduled_jobs_type_idx" ON "scheduled_jobs"("type");
