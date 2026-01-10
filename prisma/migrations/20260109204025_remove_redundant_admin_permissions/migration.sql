/*
  Warnings:

  - You are about to drop the column `canAccessAnalytics` on the `admin_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `canApproveSMEs` on the `admin_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `canManageManufacturers` on the `admin_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `canManageUsers` on the `admin_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "admin_profiles" DROP COLUMN "canAccessAnalytics",
DROP COLUMN "canApproveSMEs",
DROP COLUMN "canManageManufacturers",
DROP COLUMN "canManageUsers";
