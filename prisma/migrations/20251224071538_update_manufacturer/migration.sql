/*
  Warnings:

  - You are about to drop the column `businessLicense` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `companyName` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `contactEmail` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `contactPhone` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `contractUrl` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `partnershipDate` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `products` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `taxId` on the `manufacturers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `manufacturers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[registrationNumber]` on the table `manufacturers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `city` to the `manufacturers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country` to the `manufacturers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `manufacturers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `manufacturers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `manufacturers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `manufacturers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `manufacturers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `manufacturers` table without a default value. This is not possible if the table is not empty.
  - Made the column `address` on table `manufacturers` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- DropForeignKey
ALTER TABLE "manufacturers" DROP CONSTRAINT "manufacturers_regionId_fkey";

-- DropIndex
DROP INDEX "manufacturers_contactEmail_key";

-- AlterTable
ALTER TABLE "manufacturers" DROP COLUMN "businessLicense",
DROP COLUMN "companyName",
DROP COLUMN "contactEmail",
DROP COLUMN "contactPhone",
DROP COLUMN "contractUrl",
DROP COLUMN "partnershipDate",
DROP COLUMN "products",
DROP COLUMN "taxId",
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "state" TEXT NOT NULL,
ADD COLUMN     "updatedBy" TEXT NOT NULL,
ADD COLUMN     "website" TEXT,
ALTER COLUMN "address" SET NOT NULL,
ALTER COLUMN "regionId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "manufacturerId" TEXT;

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "website" TEXT,
    "manufacturerId" TEXT NOT NULL,
    "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
    "establishedYear" INTEGER,
    "country" TEXT,
    "tagline" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_manufacturerId_key" ON "brands"("name", "manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_name_key" ON "manufacturers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_registrationNumber_key" ON "manufacturers"("registrationNumber");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
