-- CreateTable: OrganizationInvite (조직 초대 링크)
CREATE TABLE IF NOT EXISTS "OrganizationInvite" (
    "id"               TEXT NOT NULL,
    "organizationId"   TEXT NOT NULL,
    "token"            TEXT NOT NULL,
    "email"            TEXT,
    "role"             "OrganizationRole" NOT NULL DEFAULT 'VIEWER',
    "expiresAt"        TIMESTAMP(3) NOT NULL,
    "acceptedAt"       TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt"        TIMESTAMP(3),
    "createdByUserId"  TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationInvite_token_key" ON "OrganizationInvite"("token");
CREATE INDEX IF NOT EXISTS "OrganizationInvite_organizationId_idx" ON "OrganizationInvite"("organizationId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
