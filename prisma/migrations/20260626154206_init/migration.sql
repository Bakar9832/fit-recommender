-- CreateEnum
CREATE TYPE "FitType" AS ENUM ('fitted', 'regular', 'loose');

-- CreateEnum
CREATE TYPE "GarmentType" AS ENUM ('one_piece', 'two_piece');

-- CreateTable
CREATE TABLE "Outlet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "outletKey" TEXT NOT NULL,
    "adminToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SizeChartTemplate" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fitType" "FitType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SizeChartTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SizeChartRow" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sizeLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "bust" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "hip" DOUBLE PRECISION,
    "kameezLength" DOUBLE PRECISION,
    "trouserWaist" DOUBLE PRECISION,
    "trouserLength" DOUBLE PRECISION,

    CONSTRAINT "SizeChartRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT,
    "templateId" TEXT NOT NULL,
    "fitTypeOverride" "FitType",
    "garmentType" "GarmentType" NOT NULL,
    "fabric" TEXT,
    "colorSlot" INTEGER,
    "formality" TEXT,
    "styleTag" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_outletKey_key" ON "Outlet"("outletKey");

-- CreateIndex
CREATE UNIQUE INDEX "SizeChartRow_templateId_sizeLabel_key" ON "SizeChartRow"("templateId", "sizeLabel");

-- CreateIndex
CREATE INDEX "Product_outletId_colorSlot_formality_idx" ON "Product"("outletId", "colorSlot", "formality");

-- CreateIndex
CREATE UNIQUE INDEX "Product_outletId_sku_key" ON "Product"("outletId", "sku");

-- AddForeignKey
ALTER TABLE "SizeChartTemplate" ADD CONSTRAINT "SizeChartTemplate_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SizeChartRow" ADD CONSTRAINT "SizeChartRow_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SizeChartTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SizeChartTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
