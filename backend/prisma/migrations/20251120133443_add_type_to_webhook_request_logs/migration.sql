-- AlterTable
ALTER TABLE "webhook_request_logs" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'webhook';

-- CreateIndex
CREATE INDEX "webhook_request_logs_type_webhookId_timestamp_idx" ON "webhook_request_logs"("type", "webhookId", "timestamp");

-- CreateIndex
CREATE INDEX "webhook_request_logs_type_workflowId_timestamp_idx" ON "webhook_request_logs"("type", "workflowId", "timestamp");

-- CreateIndex
CREATE INDEX "webhook_request_logs_type_userId_timestamp_idx" ON "webhook_request_logs"("type", "userId", "timestamp");
