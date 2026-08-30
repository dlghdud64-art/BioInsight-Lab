import { PrismaClient } from '@prisma/client';
import { assertScriptDbTarget } from "./lib/db-target";
import * as dotenv from "dotenv";
import * as path from "path";

// §prisma-target-helper — 게이트가 process.env 를 읽으므로 **먼저** 로드한다.
//   순서는 기존 스크립트(make-admin·backfill·import-catno)와 같다:
//   .env.local 을 먼저 읽어 우선하게 한다(Next 의 로드 순서 · db-guard.ts 와 동축).
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });



// §prisma-target-helper — 접속 전 대상 확정. Prisma 클라이언트를 만들기 **전에** 부른다.
//   대상을 말하지 않은 채 접속이 열리면 이 게이트가 없는 것과 같다.
//   출력: [db-target] ref=<ref> mode=<test|prod>
assertScriptDbTarget();

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
