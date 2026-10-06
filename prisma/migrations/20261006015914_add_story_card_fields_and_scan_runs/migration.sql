-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "firstReportedAt" TIMESTAMP(3),
ADD COLUMN     "freshnessScore" DOUBLE PRECISION,
ADD COLUMN     "globalImpact" DOUBLE PRECISION,
ADD COLUMN     "humanImpact" DOUBLE PRECISION,
ADD COLUMN     "lastUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "sourceConfidence" TEXT;

-- CreateTable
CREATE TABLE "scan_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "articlesFetched" INTEGER NOT NULL DEFAULT 0,
    "newStories" INTEGER NOT NULL DEFAULT 0,
    "updatedStories" INTEGER NOT NULL DEFAULT 0,
    "sources" JSONB,

    CONSTRAINT "scan_runs_pkey" PRIMARY KEY ("id")
);
