-- CreateEnum
CREATE TYPE "DevicePortStatus" AS ENUM ('up', 'down');

-- CreateTable
CREATE TABLE "device_ports" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "portNumber" INTEGER NOT NULL,
    "status" "DevicePortStatus" NOT NULL DEFAULT 'down',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_ports_pkey" PRIMARY KEY ("id")
);

-- Backfill one persisted port row for each existing device port.
INSERT INTO "device_ports" (
    "deviceId",
    "portNumber",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    device."id",
    generated."portNumber",
    'down'::"DevicePortStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "devices" AS device
CROSS JOIN LATERAL generate_series(1, device."portCount")
AS generated("portNumber");

-- CreateIndex
CREATE UNIQUE INDEX "device_ports_deviceId_portNumber_key"
ON "device_ports"("deviceId", "portNumber");

-- CreateIndex
CREATE INDEX "device_ports_deviceId_status_idx"
ON "device_ports"("deviceId", "status");

-- AddForeignKey
ALTER TABLE "device_ports"
ADD CONSTRAINT "device_ports_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
