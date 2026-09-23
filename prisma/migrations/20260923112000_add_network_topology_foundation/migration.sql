-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('GATEWAY', 'ROUTER', 'SWITCH', 'ACCESS_POINT', 'CLIENT', 'SERVER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PortAdminStatus" AS ENUM ('UP', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PortOperStatus" AS ENUM ('UP', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PortDuplex" AS ENUM ('FULL', 'HALF', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PoeStatus" AS ENUM ('POWERED', 'OFF', 'UNSUPPORTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TopologyLinkType" AS ENUM ('ETHERNET', 'WIRELESS', 'VPN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TopologyLinkStatus" AS ENUM ('UP', 'DOWN', 'DEGRADED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DiscoverySource" AS ENUM ('MANUAL', 'SNMP', 'LLDP', 'CDP');

-- CreateTable
CREATE TABLE "network_sites" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "topologyRevision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_sites_pkey" PRIMARY KEY ("id")
);

-- Backfill one default site for every existing user.
INSERT INTO "network_sites" ("id", "name", "ownerId", "topologyRevision", "createdAt", "updatedAt")
SELECT
    'default-site-' || "id"::text,
    'Default Site',
    "id",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users";

-- Extend devices before backfilling site ownership.
ALTER TABLE "devices"
ADD COLUMN "siteId" TEXT,
ADD COLUMN "type" "DeviceType" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "macAddress" VARCHAR(17),
ADD COLUMN "serialNumber" VARCHAR(100),
ADD COLUMN "vendor" VARCHAR(100),
ADD COLUMN "model" VARCHAR(100),
ADD COLUMN "lastSeenAt" TIMESTAMP(3),
ADD COLUMN "metadata" JSONB;

UPDATE "devices" AS d
SET "siteId" = s."id"
FROM "network_sites" AS s
WHERE s."ownerId" = d."ownerId"
  AND s."name" = 'Default Site';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "devices" WHERE "siteId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill topology site ownership for all devices';
  END IF;
END $$;

ALTER TABLE "devices" ALTER COLUMN "siteId" SET NOT NULL;

-- Replace global device uniqueness with site-scoped uniqueness.
DROP INDEX "devices_name_key";
DROP INDEX "devices_ip_key";

CREATE UNIQUE INDEX "network_sites_ownerId_name_key" ON "network_sites"("ownerId", "name");
CREATE UNIQUE INDEX "network_sites_id_ownerId_key" ON "network_sites"("id", "ownerId");
CREATE INDEX "network_sites_ownerId_updatedAt_idx" ON "network_sites"("ownerId", "updatedAt");

CREATE UNIQUE INDEX "devices_siteId_name_key" ON "devices"("siteId", "name");
CREATE UNIQUE INDEX "devices_siteId_ip_key" ON "devices"("siteId", "ip");
CREATE INDEX "devices_siteId_idx" ON "devices"("siteId");
CREATE INDEX "devices_siteId_type_idx" ON "devices"("siteId", "type");
CREATE INDEX "devices_status_idx" ON "devices"("status");

-- Align device ownership semantics with site ownership.
ALTER TABLE "devices" DROP CONSTRAINT "devices_ownerId_fkey";

ALTER TABLE "network_sites"
ADD CONSTRAINT "network_sites_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices"
ADD CONSTRAINT "devices_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices"
ADD CONSTRAINT "devices_site_owner_fkey"
FOREIGN KEY ("siteId", "ownerId") REFERENCES "network_sites"("id", "ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "device_ports" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "ifIndex" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "macAddress" VARCHAR(17),
    "adminStatus" "PortAdminStatus" NOT NULL DEFAULT 'UNKNOWN',
    "operStatus" "PortOperStatus" NOT NULL DEFAULT 'UNKNOWN',
    "speedMbps" INTEGER,
    "duplex" "PortDuplex" NOT NULL DEFAULT 'UNKNOWN',
    "poeStatus" "PoeStatus" NOT NULL DEFAULT 'UNKNOWN',
    "nativeVlanId" INTEGER,
    "lagId" VARCHAR(100),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_ports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "device_ports_speed_nonnegative" CHECK ("speedMbps" IS NULL OR "speedMbps" >= 0),
    CONSTRAINT "device_ports_vlan_range" CHECK ("nativeVlanId" IS NULL OR ("nativeVlanId" >= 1 AND "nativeVlanId" <= 4094))
);

CREATE UNIQUE INDEX "device_ports_deviceId_name_key" ON "device_ports"("deviceId", "name");
CREATE UNIQUE INDEX "device_ports_deviceId_ifIndex_key" ON "device_ports"("deviceId", "ifIndex");
CREATE INDEX "device_ports_deviceId_operStatus_idx" ON "device_ports"("deviceId", "operStatus");

ALTER TABLE "device_ports"
ADD CONSTRAINT "device_ports_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "topology_links" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "aDeviceId" INTEGER NOT NULL,
    "aPortId" INTEGER,
    "zDeviceId" INTEGER NOT NULL,
    "zPortId" INTEGER,
    "canonicalKey" VARCHAR(160) NOT NULL,
    "linkType" "TopologyLinkType" NOT NULL DEFAULT 'ETHERNET',
    "discoverySource" "DiscoverySource" NOT NULL DEFAULT 'MANUAL',
    "status" "TopologyLinkStatus" NOT NULL DEFAULT 'UNKNOWN',
    "speedMbps" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topology_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "topology_links_endpoint_order" CHECK ("aDeviceId" < "zDeviceId"),
    CONSTRAINT "topology_links_confidence_range" CHECK ("confidence" >= 0 AND "confidence" <= 1),
    CONSTRAINT "topology_links_speed_nonnegative" CHECK ("speedMbps" IS NULL OR "speedMbps" >= 0)
);

CREATE UNIQUE INDEX "topology_links_canonicalKey_key" ON "topology_links"("canonicalKey");
CREATE INDEX "topology_links_siteId_status_idx" ON "topology_links"("siteId", "status");
CREATE INDEX "topology_links_aDeviceId_idx" ON "topology_links"("aDeviceId");
CREATE INDEX "topology_links_zDeviceId_idx" ON "topology_links"("zDeviceId");
CREATE INDEX "topology_links_lastSeenAt_idx" ON "topology_links"("lastSeenAt");

ALTER TABLE "topology_links"
ADD CONSTRAINT "topology_links_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "network_sites"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topology_links"
ADD CONSTRAINT "topology_links_aDeviceId_fkey"
FOREIGN KEY ("aDeviceId") REFERENCES "devices"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topology_links"
ADD CONSTRAINT "topology_links_zDeviceId_fkey"
FOREIGN KEY ("zDeviceId") REFERENCES "devices"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topology_links"
ADD CONSTRAINT "topology_links_aPortId_fkey"
FOREIGN KEY ("aPortId") REFERENCES "device_ports"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "topology_links"
ADD CONSTRAINT "topology_links_zPortId_fkey"
FOREIGN KEY ("zPortId") REFERENCES "device_ports"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
