-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
  'USER_REGISTERED',
  'USER_LOGGED_IN',
  'DEVICE_CREATED',
  'DEVICE_UPDATED',
  'DEVICE_DELETED'
);

-- CreateTable
CREATE TABLE "audit_logs" (
  "id" SERIAL NOT NULL,
  "action" "AuditAction" NOT NULL,
  "resourceType" VARCHAR(50) NOT NULL,
  "resourceId" VARCHAR(100),
  "actorId" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx"
ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
