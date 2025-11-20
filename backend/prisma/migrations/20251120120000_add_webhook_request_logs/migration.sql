-- CreateTable
CREATE TABLE "webhook_request_logs" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "body" JSONB,
    "query" JSONB,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "executionId" TEXT,
    "responseCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "testMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_request_logs_webhookId_timestamp_idx" ON "webhook_request_logs"("webhookId", "timestamp");

-- CreateIndex
CREATE INDEX "webhook_request_logs_workflowId_timestamp_idx" ON "webhook_request_logs"("workflowId", "timestamp");

-- CreateIndex
CREATE INDEX "webhook_request_logs_userId_timestamp_idx" ON "webhook_request_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "webhook_request_logs_timestamp_idx" ON "webhook_request_logs"("timestamp");
