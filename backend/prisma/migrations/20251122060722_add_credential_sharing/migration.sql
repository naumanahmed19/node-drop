-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('USE', 'VIEW', 'EDIT');

-- CreateTable
CREATE TABLE "credential_shares" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "sharedWithUserId" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'USE',
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharedByUserId" TEXT,

    CONSTRAINT "credential_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credential_shares_credentialId_idx" ON "credential_shares"("credentialId");

-- CreateIndex
CREATE INDEX "credential_shares_sharedWithUserId_idx" ON "credential_shares"("sharedWithUserId");

-- CreateIndex
CREATE INDEX "credential_shares_ownerUserId_idx" ON "credential_shares"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "credential_shares_credentialId_sharedWithUserId_key" ON "credential_shares"("credentialId", "sharedWithUserId");

-- AddForeignKey
ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_sharedWithUserId_fkey" FOREIGN KEY ("sharedWithUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
