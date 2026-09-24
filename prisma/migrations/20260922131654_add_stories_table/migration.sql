-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT,
    "sourceUrls" TEXT[],
    "eventTime" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT NOT NULL,
    "verificationTier" TEXT,
    "fitScore" DOUBLE PRECISION,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stories_dedupeKey_key" ON "stories"("dedupeKey");
