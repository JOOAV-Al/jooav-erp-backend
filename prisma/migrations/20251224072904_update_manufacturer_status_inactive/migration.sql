/*
  Warnings:

  - The values [TERMINATED] on the enum `ManufacturerStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ManufacturerStatus_new" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'INACTIVE');
ALTER TABLE "public"."manufacturers" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "manufacturers" ALTER COLUMN "status" TYPE "ManufacturerStatus_new" USING ("status"::text::"ManufacturerStatus_new");
ALTER TYPE "ManufacturerStatus" RENAME TO "ManufacturerStatus_old";
ALTER TYPE "ManufacturerStatus_new" RENAME TO "ManufacturerStatus";
DROP TYPE "public"."ManufacturerStatus_old";
ALTER TABLE "manufacturers" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;
