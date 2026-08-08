CREATE TYPE "AgentStepType" AS ENUM ('MODEL_CALL');

CREATE TYPE "AgentStepStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

ALTER TABLE "ai_tasks"
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "agent_steps" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "type" "AgentStepType" NOT NULL,
  "status" "AgentStepStatus" NOT NULL DEFAULT 'RUNNING',
  "sequence" INTEGER NOT NULL,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_steps_taskId_sequence_key"
ON "agent_steps"("taskId", "sequence");

CREATE INDEX "agent_steps_taskId_createdAt_idx"
ON "agent_steps"("taskId", "createdAt");

ALTER TABLE "agent_steps"
ADD CONSTRAINT "agent_steps_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "ai_tasks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
