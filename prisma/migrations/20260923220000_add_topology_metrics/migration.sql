CREATE TYPE "MetricSource" AS ENUM (
  'MANUAL',
  'SNMP',
  'TELEMETRY'
);

CREATE TABLE "device_metric_samples" (
  "id" BIGSERIAL NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "source" "MetricSource" NOT NULL,
  "sampledAt" TIMESTAMP(3) NOT NULL,
  "rxBitsPerSecond" DOUBLE PRECISION,
  "txBitsPerSecond" DOUBLE PRECISION,
  "cpuPercent" DOUBLE PRECISION,
  "memoryPercent" DOUBLE PRECISION,
  "temperatureCelsius" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "device_metric_samples_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_metric_samples_rx_nonnegative"
    CHECK ("rxBitsPerSecond" IS NULL OR "rxBitsPerSecond" >= 0),
  CONSTRAINT "device_metric_samples_tx_nonnegative"
    CHECK ("txBitsPerSecond" IS NULL OR "txBitsPerSecond" >= 0),
  CONSTRAINT "device_metric_samples_cpu_range"
    CHECK ("cpuPercent" IS NULL OR ("cpuPercent" >= 0 AND "cpuPercent" <= 100)),
  CONSTRAINT "device_metric_samples_memory_range"
    CHECK ("memoryPercent" IS NULL OR ("memoryPercent" >= 0 AND "memoryPercent" <= 100))
);

CREATE TABLE "topology_link_metric_samples" (
  "id" BIGSERIAL NOT NULL,
  "linkId" TEXT NOT NULL,
  "source" "MetricSource" NOT NULL,
  "sampledAt" TIMESTAMP(3) NOT NULL,
  "aToZBitsPerSecond" DOUBLE PRECISION,
  "zToABitsPerSecond" DOUBLE PRECISION,
  "utilizationPercent" DOUBLE PRECISION,
  "errorRatePercent" DOUBLE PRECISION,
  "packetLossPercent" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "topology_link_metric_samples_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "topology_link_metric_samples_a_to_z_nonnegative"
    CHECK ("aToZBitsPerSecond" IS NULL OR "aToZBitsPerSecond" >= 0),
  CONSTRAINT "topology_link_metric_samples_z_to_a_nonnegative"
    CHECK ("zToABitsPerSecond" IS NULL OR "zToABitsPerSecond" >= 0),
  CONSTRAINT "topology_link_metric_samples_utilization_range"
    CHECK (
      "utilizationPercent" IS NULL OR
      ("utilizationPercent" >= 0 AND "utilizationPercent" <= 100)
    ),
  CONSTRAINT "topology_link_metric_samples_error_rate_range"
    CHECK (
      "errorRatePercent" IS NULL OR
      ("errorRatePercent" >= 0 AND "errorRatePercent" <= 100)
    ),
  CONSTRAINT "topology_link_metric_samples_packet_loss_range"
    CHECK (
      "packetLossPercent" IS NULL OR
      ("packetLossPercent" >= 0 AND "packetLossPercent" <= 100)
    )
);

CREATE UNIQUE INDEX "device_metric_samples_deviceId_source_sampledAt_key"
  ON "device_metric_samples"("deviceId", "source", "sampledAt");

CREATE INDEX "device_metric_samples_deviceId_sampledAt_idx"
  ON "device_metric_samples"("deviceId", "sampledAt" DESC);

CREATE UNIQUE INDEX "topology_link_metric_samples_linkId_source_sampledAt_key"
  ON "topology_link_metric_samples"("linkId", "source", "sampledAt");

CREATE INDEX "topology_link_metric_samples_linkId_sampledAt_idx"
  ON "topology_link_metric_samples"("linkId", "sampledAt" DESC);

ALTER TABLE "device_metric_samples"
  ADD CONSTRAINT "device_metric_samples_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topology_link_metric_samples"
  ADD CONSTRAINT "topology_link_metric_samples_linkId_fkey"
  FOREIGN KEY ("linkId") REFERENCES "topology_links"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
