/*
  Warnings:

  - The values [SUB_ADMIN] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `assignedSubAdminId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `bio` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the `customers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sub_admin_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PROCUREMENT_OFFICER', 'SME_USER');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SME_USER';
COMMIT;

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_assignedSubAdminId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_customerId_fkey";

-- DropForeignKey
ALTER TABLE "sub_admin_profiles" DROP CONSTRAINT "sub_admin_profiles_regionId_fkey";

-- DropForeignKey
ALTER TABLE "sub_admin_profiles" DROP CONSTRAINT "sub_admin_profiles_userId_fkey";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "assignedSubAdminId",
DROP COLUMN "customerId",
ADD COLUMN     "assignedProcurementOfficerId" TEXT;

-- AlterTable
ALTER TABLE "user_profiles" DROP COLUMN "bio",
DROP COLUMN "dateOfBirth",
DROP COLUMN "zipCode";

-- DropTable
DROP TABLE "customers";

-- DropTable
DROP TABLE "sub_admin_profiles";

-- DropEnum
DROP TYPE "CustomerStatus";

-- CreateTable
CREATE TABLE "procurement_officer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regionId" TEXT,
    "employeeId" TEXT NOT NULL,
    "specializations" TEXT[],
    "maxOrderValue" DECIMAL(15,2),
    "ordersProcessed" INTEGER NOT NULL DEFAULT 0,
    "averageProcessingTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_officer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procurement_officer_profiles_userId_key" ON "procurement_officer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_officer_profiles_employeeId_key" ON "procurement_officer_profiles"("employeeId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignedProcurementOfficerId_fkey" FOREIGN KEY ("assignedProcurementOfficerId") REFERENCES "procurement_officer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_officer_profiles" ADD CONSTRAINT "procurement_officer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_officer_profiles" ADD CONSTRAINT "procurement_officer_profiles_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
