CREATE TYPE "DiscoveryRunStatus" AS ENUM (
  'PENDING',
  'DISCOVERING',
  'RECONCILING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "discovery_runs" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "requestedById" INTEGER,
  "source" "DiscoverySource" NOT NULL,
  "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'PENDING',
  "requestPayload" JSONB,
  "observationCount" INTEGER NOT NULL DEFAULT 0,
  "resolvedObservationCount" INTEGER NOT NULL DEFAULT 0,
  "reconciledLinkCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discovery_runs_observation_count_nonnegative"
    CHECK ("observationCount" >= 0),
  CONSTRAINT "discovery_runs_resolved_count_nonnegative"
    CHECK ("resolvedObservationCount" >= 0),
  CONSTRAINT "discovery_runs_link_count_nonnegative"
    CHECK ("reconciledLinkCount" >= 0)
);

CREATE TABLE "topology_observations" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "source" "DiscoverySource" NOT NULL,
  "localDeviceId" INTEGER NOT NULL,
  "localPortId" INTEGER,
  "localPortName" VARCHAR(100),
  "localPortIfIndex" INTEGER,
  "remoteDeviceId" INTEGER,
  "remotePortId" INTEGER,
  "remoteManagementIp" INET,
  "remoteMacAddress" VARCHAR(17),
  "remoteChassisId" VARCHAR(255),
  "remotePortName" VARCHAR(100),
  "remotePortIfIndex" INTEGER,
  "aDeviceId" INTEGER,
  "aPortId" INTEGER,
  "zDeviceId" INTEGER,
  "zPortId" INTEGER,
  "canonicalKey" VARCHAR(160),
  "linkType" "TopologyLinkType" NOT NULL DEFAULT 'ETHERNET',
  "linkStatus" "TopologyLinkStatus" NOT NULL DEFAULT 'UNKNOWN',
  "speedMbps" INTEGER,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "resolutionError" VARCHAR(500),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "topology_observations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "topology_observations_local_device_positive"
    CHECK ("localDeviceId" > 0),
  CONSTRAINT "topology_observations_remote_device_positive"
    CHECK ("remoteDeviceId" IS NULL OR "remoteDeviceId" > 0),
  CONSTRAINT "topology_observations_speed_nonnegative"
    CHECK ("speedMbps" IS NULL OR "speedMbps" >= 0),
  CONSTRAINT "topology_observations_confidence_range"
    CHECK ("confidence" >= 0 AND "confidence" <= 1)
);

CREATE INDEX "discovery_runs_siteId_createdAt_idx"
  ON "discovery_runs"("siteId", "createdAt");

CREATE INDEX "discovery_runs_siteId_status_idx"
  ON "discovery_runs"("siteId", "status");

CREATE INDEX "discovery_runs_requestedById_createdAt_idx"
  ON "discovery_runs"("requestedById", "createdAt");

CREATE INDEX "topology_observations_runId_idx"
  ON "topology_observations"("runId");

CREATE INDEX "topology_observations_canonicalKey_expiresAt_idx"
  ON "topology_observations"("canonicalKey", "expiresAt");

CREATE INDEX "topology_observations_localDeviceId_idx"
  ON "topology_observations"("localDeviceId");

CREATE INDEX "topology_observations_remoteDeviceId_idx"
  ON "topology_observations"("remoteDeviceId");

ALTER TABLE "discovery_runs"
  ADD CONSTRAINT "discovery_runs_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "network_sites"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discovery_runs"
  ADD CONSTRAINT "discovery_runs_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "topology_observations"
  ADD CONSTRAINT "topology_observations_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "discovery_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
