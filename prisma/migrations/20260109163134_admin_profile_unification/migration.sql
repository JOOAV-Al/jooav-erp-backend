/*
  Warnings:

  - You are about to drop the `super_admin_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "super_admin_profiles" DROP CONSTRAINT "super_admin_profiles_userId_fkey";

-- DropTable
DROP TABLE "super_admin_profiles";

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" JSONB,
    "assignedRegions" TEXT[],
    "lastActivity" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "accountLockUntil" TIMESTAMP(3),
    "canManageManufacturers" BOOLEAN NOT NULL DEFAULT true,
    "canApproveSMEs" BOOLEAN NOT NULL DEFAULT true,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
    "canAccessAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "canModifySystemConfig" BOOLEAN NOT NULL DEFAULT false,
    "canSuspendAdmins" BOOLEAN NOT NULL DEFAULT false,
    "canChangeUserRoles" BOOLEAN NOT NULL DEFAULT false,
    "canChangeUserEmails" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
