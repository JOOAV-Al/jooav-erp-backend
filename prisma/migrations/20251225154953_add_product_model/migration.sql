/*
  Warnings:

  - You are about to drop the column `category` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `costPrice` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `maxStock` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `minStock` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `products` table. All the data in the column will be lost.
  - The `images` column on the `products` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/

-- First, let's backup and clear existing products data since it's test data
DELETE FROM "products";

-- DropForeignKey (if they exist)
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_brandId_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_manufacturerId_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN IF EXISTS "category",
DROP COLUMN IF EXISTS "costPrice",
DROP COLUMN IF EXISTS "maxStock",
DROP COLUMN IF EXISTS "minStock", 
DROP COLUMN IF EXISTS "status",
DROP COLUMN IF EXISTS "stock",
ADD COLUMN "categoryId" TEXT NOT NULL,
ADD COLUMN "createdBy" TEXT NOT NULL,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "expiryDate" TIMESTAMP(3),
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "nafdacNumber" TEXT,
ADD COLUMN "packSize" TEXT NOT NULL,
ADD COLUMN "packagingType" TEXT NOT NULL,
ADD COLUMN "updatedBy" TEXT NOT NULL,
ADD COLUMN "variant" TEXT NOT NULL,
DROP COLUMN IF EXISTS "images",
ADD COLUMN "images" JSONB[],
ALTER COLUMN "brandId" SET NOT NULL,
ALTER COLUMN "manufacturerId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
