CREATE TYPE "ConversationMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "conversations" (
  "id" TEXT NOT NULL,
  "ownerId" INTEGER NOT NULL,
  "busy" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_tasks"
ADD COLUMN "conversationId" TEXT;

INSERT INTO "conversations" (
  "id",
  "ownerId",
  "busy",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('legacy_conv_', t."id"),
  t."ownerId",
  false,
  t."createdAt",
  t."updatedAt"
FROM "ai_tasks" t;

UPDATE "ai_tasks"
SET "conversationId" = concat('legacy_conv_', "id")
WHERE "conversationId" IS NULL;

CREATE TABLE "conversation_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "role" "ConversationMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

INSERT INTO "conversation_messages" (
  "id",
  "conversationId",
  "taskId",
  "role",
  "content",
  "sequence",
  "createdAt"
)
SELECT
  concat('legacy_user_', t."id"),
  t."conversationId",
  t."id",
  'USER'::"ConversationMessageRole",
  t."prompt",
  1,
  t."createdAt"
FROM "ai_tasks" t;

ALTER TABLE "ai_tasks"
ALTER COLUMN "conversationId" SET NOT NULL;

CREATE INDEX "conversations_ownerId_updatedAt_idx"
ON "conversations"("ownerId", "updatedAt");

CREATE INDEX "ai_tasks_conversationId_createdAt_idx"
ON "ai_tasks"("conversationId", "createdAt");

CREATE UNIQUE INDEX "conversation_messages_conversationId_sequence_key"
ON "conversation_messages"("conversationId", "sequence");

CREATE UNIQUE INDEX "conversation_messages_taskId_role_key"
ON "conversation_messages"("taskId", "role");

CREATE INDEX "conversation_messages_conversationId_createdAt_idx"
ON "conversation_messages"("conversationId", "createdAt");

ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_tasks"
ADD CONSTRAINT "ai_tasks_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_messages"
ADD CONSTRAINT "conversation_messages_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_messages"
ADD CONSTRAINT "conversation_messages_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "ai_tasks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
