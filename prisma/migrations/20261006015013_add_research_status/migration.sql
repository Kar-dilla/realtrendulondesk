-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "researchError" TEXT,
ADD COLUMN     "researchInstructions" TEXT,
ADD COLUMN     "researchStatus" TEXT,
ADD COLUMN     "searchResults" JSONB;
