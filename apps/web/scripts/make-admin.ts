/**
 * 특정 사용자를 모든 조직의 ADMIN으로 승격시키는 스크립트
 *
 * 실행 방법:
 *   cd apps/web
 *   npx tsx scripts/make-admin.ts
 *
 * 또는:
 *   pnpm --filter web db:make-admin
 *
 * 주의: DIRECT_URL 환경 변수가 필요할 수 있습니다 (.env.local)
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
  console.log("Admin 승격 스크립트 시작");
  console.log(`대상 이메일: ${TARGET_EMAIL}\n`);

  // 1. 사용자 조회
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
  });

  if (!user) {
    console.error(`사용자를 찾을 수 없습니다: ${TARGET_EMAIL}`);
    console.error("이메일 주소를 확인하거나 ADMIN_EMAIL 환경 변수를 설정하세요.");
    process.exit(1);
  }

  console.log(`사용자 발견: ${user.name ?? user.email} (id: ${user.id})`);

  // 2. 모든 조직 조회
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  if (organizations.length === 0) {
    console.warn("등록된 조직이 없습니다.");
    process.exit(0);
  }

  console.log(`\n조직 ${organizations.length}개에 ADMIN으로 추가/승격합니다.`);

  // 3. 각 조직에 대해 upsert (없으면 생성, 있으면 ADMIN으로 업데이트)
  let created = 0;
  let updated = 0;

  for (const org of organizations) {
    const existing = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: user.id, organizationId: org.id },
      },
    });

    if (existing) {
      if (existing.role !== OrganizationRole.ADMIN) {
        await prisma.organizationMember.update({
          where: { id: existing.id },
          data: { role: OrganizationRole.ADMIN },
        });
        updated++;
        console.log(`  - ${org.name}: ${existing.role} -> ADMIN`);
      } else {
        console.log(`  - ${org.name}: 이미 ADMIN`);
      }
    } else {
      await prisma.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: OrganizationRole.ADMIN,
        },
      });
      created++;
      console.log(`  - ${org.name}: 새로 추가 (ADMIN)`);
    }
  }

  console.log(`\n완료: ${created}개 추가, ${updated}개 승격`);
}

main()
  .catch((e) => {
    console.error("오류 발생:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
