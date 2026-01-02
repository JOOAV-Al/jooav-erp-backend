/*
  Warnings:

  - You are about to drop the column `barcode` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `variant` on the `products` table. All the data in the column will be lost.
  - Added the required column `variantId` to the `products` table without a default value. This is not possible if the table is not empty.

*/

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable for variants first
CREATE TABLE "variants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brandId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- Create unique index for variants
CREATE UNIQUE INDEX "variants_name_brandId_key" ON "variants"("name", "brandId");

-- Add foreign key constraints for variants
ALTER TABLE "variants" ADD CONSTRAINT "variants_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "variants" ADD CONSTRAINT "variants_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "variants" ADD CONSTRAINT "variants_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "variants" ADD CONSTRAINT "variants_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing product variant data to variants table
-- Create variants from existing product variants
INSERT INTO "variants" ("id", "name", "brandId", "createdBy", "updatedBy", "createdAt", "updatedAt")
SELECT 
    'cmj' || encode(sha256(("brandId" || variant)::bytea), 'hex')::text,
    variant,
    "brandId",
    "createdBy",
    "updatedBy",
    "createdAt",
    "updatedAt"
FROM products
WHERE variant IS NOT NULL
GROUP BY variant, "brandId", "createdBy", "updatedBy", "createdAt", "updatedAt"
ON CONFLICT DO NOTHING;

-- Add variantId column to products (nullable first)
ALTER TABLE "products" ADD COLUMN "variantId" TEXT;

-- Update products to reference the new variants
UPDATE products SET "variantId" = (
    SELECT v.id 
    FROM variants v 
    WHERE v.name = products.variant 
    AND v."brandId" = products."brandId"
    LIMIT 1
);

-- Make variantId NOT NULL now that all products have variants
ALTER TABLE "products" ALTER COLUMN "variantId" SET NOT NULL;

-- Add new columns to products
ALTER TABLE "products" ADD COLUMN "discount" DECIMAL(5,2);
ALTER TABLE "products" ADD COLUMN "thumbnail" TEXT;

-- Drop old columns
DROP INDEX IF EXISTS "products_barcode_key";
ALTER TABLE "products" DROP COLUMN IF EXISTS "barcode";
ALTER TABLE "products" DROP COLUMN IF EXISTS "expiryDate";
ALTER TABLE "products" DROP COLUMN "variant";

-- Add foreign key for variantId
ALTER TABLE "products" ADD CONSTRAINT "products_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable for orders (add customerId)
ALTER TABLE "orders" ADD COLUMN "customerId" TEXT;

-- CreateTable for customers
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "zipCode" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
