-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "selectedAt" TIMESTAMP(3),
ADD COLUMN     "selectedForPipeline" BOOLEAN NOT NULL DEFAULT false;
