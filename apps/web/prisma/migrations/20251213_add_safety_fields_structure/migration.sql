-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "hazardCodes" JSONB,
ADD COLUMN     "pictograms" JSONB,
ADD COLUMN     "storageCondition" TEXT,
ADD COLUMN     "ppe" JSONB;

