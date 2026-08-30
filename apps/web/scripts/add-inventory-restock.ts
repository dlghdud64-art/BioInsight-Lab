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
    CREATE TABLE IF NOT EXISTS "InventoryRestock" (
      "id"          TEXT NOT NULL,
      "inventoryId" TEXT NOT NULL,
      "userId"      TEXT NOT NULL,
      "quantity"    DOUBLE PRECISION NOT NULL,
      "unit"        TEXT,
      "lotNumber"   TEXT,
      "expiryDate"  TIMESTAMP(3),
      "notes"       TEXT,
      "restockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InventoryRestock_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InventoryRestock_inventoryId_idx" ON "InventoryRestock"("inventoryId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InventoryRestock_userId_idx" ON "InventoryRestock"("userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InventoryRestock_restockedAt_idx" ON "InventoryRestock"("restockedAt")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'InventoryRestock_inventoryId_fkey'
      ) THEN
        ALTER TABLE "InventoryRestock"
          ADD CONSTRAINT "InventoryRestock_inventoryId_fkey"
          FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'InventoryRestock_userId_fkey'
      ) THEN
        ALTER TABLE "InventoryRestock"
          ADD CONSTRAINT "InventoryRestock_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$
  `);
  console.log('✅ InventoryRestock table created successfully');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
