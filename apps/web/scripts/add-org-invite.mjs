import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(`
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
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationInvite_token_key" ON "OrganizationInvite"("token")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OrganizationInvite_organizationId_idx" ON "OrganizationInvite"("organizationId")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationInvite_organizationId_fkey') THEN
        ALTER TABLE "OrganizationInvite"
          ADD CONSTRAINT "OrganizationInvite_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$
  `);
  console.log('✅ OrganizationInvite table created successfully');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
