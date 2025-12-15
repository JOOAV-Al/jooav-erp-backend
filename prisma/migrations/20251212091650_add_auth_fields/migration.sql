/*
  Warnings:

  - Added the required column `password` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add columns with default values for existing users
ALTER TABLE "users" 
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLogin" TIMESTAMP(3),
ADD COLUMN     "password" TEXT NOT NULL DEFAULT '$2b$12$LQv3c1yqBwlVHpPjrCyeNOHNMQBqx83KDQC0xc5L5F1s5W1B5o3gm', -- Default: "password123"
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- Update existing users to require password change on next login
UPDATE "users" SET "passwordChangedAt" = NOW() - INTERVAL '1 year' WHERE "password" = '$2b$12$LQv3c1yqBwlVHpPjrCyeNOHNMQBqx83KDQC0xc5L5F1s5W1B5o3gm';
