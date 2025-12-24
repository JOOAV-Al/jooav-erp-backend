/*
  Warnings:

  - You are about to drop the column `country` on the `brands` table. All the data in the column will be lost.
  - You are about to drop the column `establishedYear` on the `brands` table. All the data in the column will be lost.
  - You are about to drop the column `tagline` on the `brands` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `brands` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "brands" DROP COLUMN "country",
DROP COLUMN "establishedYear",
DROP COLUMN "tagline",
DROP COLUMN "website",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
