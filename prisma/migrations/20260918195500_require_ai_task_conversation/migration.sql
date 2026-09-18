INSERT INTO "conversations" (
  "id",
  "ownerId",
  "busy",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('legacy_conv_', "id"),
  "ownerId",
  false,
  "createdAt",
  "updatedAt"
FROM "ai_tasks"
WHERE "conversationId" IS NULL;

UPDATE "ai_tasks"
SET "conversationId" = concat('legacy_conv_', "id")
WHERE "conversationId" IS NULL;

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
  concat('legacy_user_', "id"),
  "conversationId",
  "id",
  'USER'::"ConversationMessageRole",
  "prompt",
  1,
  "createdAt"
FROM "ai_tasks"
WHERE NOT EXISTS (
  SELECT 1
  FROM "conversation_messages" m
  WHERE m."taskId" = "ai_tasks"."id"
    AND m."role" = 'USER'::"ConversationMessageRole"
);

ALTER TABLE "ai_tasks"
ALTER COLUMN "conversationId" SET NOT NULL;
