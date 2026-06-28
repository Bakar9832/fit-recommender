-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "fabricDupatta" DOUBLE PRECISION,
ADD COLUMN     "fabricShirtBack" DOUBLE PRECISION,
ADD COLUMN     "fabricShirtFront" DOUBLE PRECISION,
ADD COLUMN     "fabricSleeves" DOUBLE PRECISION,
ADD COLUMN     "fabricTrouser" DOUBLE PRECISION,
ADD COLUMN     "unstitched" BOOLEAN NOT NULL DEFAULT false;
