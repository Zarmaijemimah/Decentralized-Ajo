-- CreateEnum for CircleCategory
CREATE TYPE "CircleCategory" AS ENUM ('GENERAL', 'EDUCATION', 'MEDICAL', 'BUSINESS', 'HOUSING', 'EMERGENCY', 'INVESTMENT', 'COMMUNITY', 'FAMILY', 'TRAVEL');

-- AlterTable: Add category column to Circle table
ALTER TABLE "Circle" ADD COLUMN "category" "CircleCategory" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex: Add index on category for efficient filtering
CREATE INDEX "Circle_category_idx" ON "Circle"("category");

-- CreateIndex: Add composite index on status and category for complex queries
CREATE INDEX "Circle_status_category_idx" ON "Circle"("status", "category");
