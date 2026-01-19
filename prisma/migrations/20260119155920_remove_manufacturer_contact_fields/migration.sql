/*
  Warnings:

  - You are about to drop the column `address` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `registrationNumber` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `manufacturers` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "manufacturers_registrationNumber_key";

-- AlterTable
ALTER TABLE "manufacturers" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "email",
DROP COLUMN "phone",
DROP COLUMN "registrationNumber",
DROP COLUMN "state",
DROP COLUMN "website";
