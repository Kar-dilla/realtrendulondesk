-- CreateTable
CREATE TABLE "verified_claims" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verified_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verified_claims_storyId_idx" ON "verified_claims"("storyId");

-- AddForeignKey
ALTER TABLE "verified_claims" ADD CONSTRAINT "verified_claims_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
