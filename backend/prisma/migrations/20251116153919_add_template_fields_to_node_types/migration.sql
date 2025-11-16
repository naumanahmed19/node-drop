-- AlterTable
ALTER TABLE "node_types" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateData" JSONB;
