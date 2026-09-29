-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "researchBrief" JSONB,
ADD COLUMN     "researchedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "topic_notes" (
    "id" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topic_notes_topicKey_key" ON "topic_notes"("topicKey");
