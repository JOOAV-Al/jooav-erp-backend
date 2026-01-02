/*
  Warnings:

  - You are about to drop the column `postalCode` on the `manufacturers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "manufacturers" DROP COLUMN "postalCode",
ALTER COLUMN "phone" DROP NOT NULL;
