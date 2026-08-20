ALTER TABLE "ai_tasks"
ADD COLUMN "lockedBy" VARCHAR(255),
ADD COLUMN "leaseToken" UUID,
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ai_tasks_leaseToken_key" ON "ai_tasks"("leaseToken");
CREATE INDEX "ai_tasks_status_leaseExpiresAt_idx"
ON "ai_tasks"("status", "leaseExpiresAt");
