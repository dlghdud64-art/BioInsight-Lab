/**
 * 특정 사용자를 모든 조직에서 ADMIN으로 승격시키는 스크립트
 *
 * 실행 방법:
 *   pnpm --filter web db:make-admin
 * 또는:
 *   cd apps/web && npx tsx scripts/make-admin.ts
 *
 * 주의: DIRECT_URL 환경 변수가 필요합니다 (.env.local)
 */

import { PrismaClient, OrganizationRole } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

// .env.local → .env 순으로 로드
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// 승격할 사용자 이메일 (변경 가능)
const TARGET_EMAIL = process.env.ADMIN_EMAIL ?? "dlghdud64@gmail.com";

const prisma = new PrismaClient({
  log: ["error"],
  datasources: process.env.DIRECT_URL
    ? { db: { url: process.env.DIRECT_URL } }
    : undefined,
});

async function main() {
  console.log("🔑 Admin 승격 스크립트 시작");
  console.log(`📧 대상 이메일: ${TARGET_EMAIL}\n`);

  // 1. 사용자 조회
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
  });

  if (!user) {
    console.error(`❌ 사용자를 찾을 수 없습니다: ${TARGET_EMAIL}`);
    console.error("   이메일 주소를 확인하거나 ADMIN_EMAIL 환경 변수를 설정하세요.");
    process.exit(1);
  }

  console.log(`✅ 사용자 발견: ${user.name ?? user.email} (id: ${user.id})`);

  // 2. 현재 멤버십 조회
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: { select: { name: true } } },
  });

  if (memberships.length === 0) {
    console.warn("⚠️  해당 사용자의 조직 멤버십이 없습니다.");
    console.warn("   조직을 먼저 생성하세요.");
    process.exit(0);
  }

  console.log(`\n📋 현재 멤버십 (${memberships.length}개):`);
  for (const m of memberships) {
    console.log(`   - ${m.organization.name}: ${m.role}`);
  }

  // 3. 모든 멤버십을 ADMIN으로 업데이트
  const result = await prisma.organizationMember.updateMany({
    where: { userId: user.id },
    data: { role: OrganizationRole.ADMIN },
  });

  console.log(`\n✅ ${result.count}개 멤버십이 ADMIN으로 승격되었습니다.`);

  // 4. 결과 확인
  const updated = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: { select: { name: true } } },
  });

  console.log("\n📋 업데이트 후 멤버십:");
  for (const m of updated) {
    console.log(`   - ${m.organization.name}: ${m.role} ✅`);
  }

  console.log("\n🎉 완료! 이제 모든 조직에서 관리자 권한을 가집니다.");
}

main()
  .catch((e) => {
    console.error("❌ 오류 발생:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
