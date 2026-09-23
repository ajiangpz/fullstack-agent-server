-- CreateTable
CREATE TABLE "topology_views" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "topologyRevision" INTEGER NOT NULL DEFAULT 0,
    "viewportX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewportY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "zoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topology_views_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "topology_views_revision_nonnegative" CHECK ("revision" >= 0),
    CONSTRAINT "topology_views_topology_revision_nonnegative" CHECK ("topologyRevision" >= 0),
    CONSTRAINT "topology_views_viewport_x_range" CHECK ("viewportX" BETWEEN -1000000 AND 1000000),
    CONSTRAINT "topology_views_viewport_y_range" CHECK ("viewportY" BETWEEN -1000000 AND 1000000),
    CONSTRAINT "topology_views_zoom_range" CHECK ("zoom" BETWEEN 0.1 AND 10)
);

-- CreateTable
CREATE TABLE "topology_view_nodes" (
    "viewId" TEXT NOT NULL,
    "nodeId" VARCHAR(128) NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "topology_view_nodes_pkey" PRIMARY KEY ("viewId", "nodeId"),
    CONSTRAINT "topology_view_nodes_x_range" CHECK ("x" BETWEEN -1000000 AND 1000000),
    CONSTRAINT "topology_view_nodes_y_range" CHECK ("y" BETWEEN -1000000 AND 1000000)
);

CREATE UNIQUE INDEX "topology_views_siteId_ownerId_key" ON "topology_views"("siteId", "ownerId");
CREATE INDEX "topology_views_ownerId_updatedAt_idx" ON "topology_views"("ownerId", "updatedAt");

ALTER TABLE "topology_views"
ADD CONSTRAINT "topology_views_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "network_sites"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topology_views"
ADD CONSTRAINT "topology_views_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topology_view_nodes"
ADD CONSTRAINT "topology_view_nodes_viewId_fkey"
FOREIGN KEY ("viewId") REFERENCES "topology_views"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
