/*
  Warnings:

  - You are about to drop the column `type` on the `node_types` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[identifier]` on the table `node_types` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `identifier` to the `node_types` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "node_types_type_key";

-- AlterTable
ALTER TABLE "node_types" DROP COLUMN "type",
ADD COLUMN     "identifier" TEXT NOT NULL,
ADD COLUMN     "nodeCategory" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "node_types_identifier_key" ON "node_types"("identifier");
