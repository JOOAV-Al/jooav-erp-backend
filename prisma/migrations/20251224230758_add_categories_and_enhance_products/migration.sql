/*
  Warnings:

  - You are about to drop the column `category` on the `products` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `categoryId` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `products` table without a default value. This is not possible if the table is not empty.

*/

-- First, create categories table
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Create indexes for categories
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE UNIQUE INDEX "categories_name_parentId_key" ON "categories"("name", "parentId");

-- Add foreign key constraints for categories
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Get the first user ID to use as default creator
DO $$
DECLARE
    default_user_id TEXT;
    default_category_id TEXT;
BEGIN
    -- Get the first user ID
    SELECT id INTO default_user_id FROM users LIMIT 1;
    
    -- Create a default "General" category if we have a user
    IF default_user_id IS NOT NULL THEN
        INSERT INTO "categories" ("id", "name", "slug", "description", "createdBy", "updatedBy", "updatedAt")
        VALUES (gen_random_uuid(), 'General', 'general', 'General category for uncategorized products', default_user_id, default_user_id, NOW())
        RETURNING "id" INTO default_category_id;
        
        -- Add new columns to products table with default values
        ALTER TABLE "products" 
            ADD COLUMN "categoryId" TEXT DEFAULT default_category_id,
            ADD COLUMN "createdBy" TEXT DEFAULT default_user_id,
            ADD COLUMN "updatedBy" TEXT DEFAULT default_user_id,
            ADD COLUMN "deletedAt" TIMESTAMP(3),
            ADD COLUMN "deletedBy" TEXT,
            ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
            ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN "packSize" TEXT,
            ADD COLUMN "slug" TEXT,
            ADD COLUMN "weight" DECIMAL(8,3);
        
        -- Generate slugs for existing products based on their names
        UPDATE "products" SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g')) WHERE "slug" IS NULL;
        
        -- Make sure all products have the required fields
        UPDATE "products" SET 
            "categoryId" = default_category_id WHERE "categoryId" IS NULL,
            "createdBy" = default_user_id WHERE "createdBy" IS NULL,
            "updatedBy" = default_user_id WHERE "updatedBy" IS NULL;
        
        -- Now make the columns NOT NULL
        ALTER TABLE "products" 
            ALTER COLUMN "categoryId" SET NOT NULL,
            ALTER COLUMN "createdBy" SET NOT NULL,
            ALTER COLUMN "updatedBy" SET NOT NULL,
            ALTER COLUMN "slug" SET NOT NULL;
    END IF;
END $$;

-- Drop the old category column
ALTER TABLE "products" DROP COLUMN "category";

-- Create unique index for product slugs
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- Add foreign key constraints for categories to users
ALTER TABLE "categories" ADD CONSTRAINT "categories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraints for products
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
