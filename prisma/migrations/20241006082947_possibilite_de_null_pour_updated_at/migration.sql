-- AlterTable
ALTER TABLE "products" ALTER COLUMN "updated_at" DROP NOT NULL,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(6);
