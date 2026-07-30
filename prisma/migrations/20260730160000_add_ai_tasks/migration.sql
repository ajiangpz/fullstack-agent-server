CREATE TYPE "AiTaskStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "ai_tasks" (
  "id" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "status" "AiTaskStatus" NOT NULL DEFAULT 'PENDING',
  "result" TEXT,
  "errorMessage" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "ownerId" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_tasks_ownerId_createdAt_idx"
ON "ai_tasks"("ownerId", "createdAt");

CREATE INDEX "ai_tasks_status_idx" ON "ai_tasks"("status");

ALTER TABLE "ai_tasks"
ADD CONSTRAINT "ai_tasks_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
