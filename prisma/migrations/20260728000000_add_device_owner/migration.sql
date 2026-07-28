-- Add the owner column as nullable so existing rows can be backfilled.
ALTER TABLE "devices" ADD COLUMN "ownerId" INTEGER;

-- Existing devices are assigned to the oldest user. The block fails with a
-- clear error when devices exist but no user is available to own them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "devices") AND NOT EXISTS (SELECT 1 FROM "users") THEN
    RAISE EXCEPTION 'Cannot add device ownership: devices exist but no users exist';
  END IF;
END $$;

UPDATE "devices"
SET "ownerId" = (SELECT "id" FROM "users" ORDER BY "id" ASC LIMIT 1)
WHERE "ownerId" IS NULL;

ALTER TABLE "devices" ALTER COLUMN "ownerId" SET NOT NULL;

CREATE INDEX "devices_ownerId_idx" ON "devices"("ownerId");

ALTER TABLE "devices"
ADD CONSTRAINT "devices_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
