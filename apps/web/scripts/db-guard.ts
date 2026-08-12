/**
 * §dev-prod-db-separation — Prisma CLI 앞단 운영 DB 차단 가드
 *
 * 배경 (2026-08-10 실측):
 *   `package.json` 의 `db:migrate` 가 `prisma migrate dev` 였고, `.env` 는 운영
 *   Supabase 를 가리키고 있었다. 즉 **`npm run db:migrate` 한 번이 운영 스키마를
 *   직접 건드리는 상태**였다. `migrate dev` 는 shadow DB 를 만들고 drift 를 감지하면
 *   reset 을 제안한다 (DEV_RUNBOOK §9.9, 2026-06-14 사고와 같은 경로).
 *
 * 설계:
 *   판정 규칙을 여기에 다시 쓰지 않는다. `src/lib/security/production-database.ts` 의
 *   판정기를 **그대로 재사용**한다 — 규칙이 두 곳에 있으면 갈리고, 갈리면 한쪽이
 *   뚫린다. 특히 `DIRECT_URL` 검사가 중요하다: 마이그레이션은 DIRECT_URL 을 쓰므로
 *   DATABASE_URL 만 보면 이 가드가 그대로 우회된다.
 *
 * 사용:
 *   `"db:migrate": "tsx scripts/db-guard.ts && prisma migrate dev"`
 *   운영 host 면 비영 종료코드로 끝나 뒤따르는 prisma 명령이 실행되지 않는다.
 *
 * 우회가 필요할 때(운영 적용):
 *   `prisma migrate deploy` 는 **생성된 마이그레이션 적용만** 하므로 이 가드를 거치지
 *   않는 별도 스크립트(`prisma:migrate`)로 둔다. 운영 변경은 그 경로로만 한다.
 */
import { config as loadEnv } from "dotenv";
import { isProductionDatabase } from "../src/lib/security/production-database";

// Prisma CLI 와 동일하게 .env 를 읽는다(.env.local 은 Prisma 가 안 읽는다 — 의도적으로 동일 동작).
loadEnv();

const label = process.argv[2] ?? "prisma 개발 명령";

if (isProductionDatabase()) {
  const host = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "")
    .replace(/^.*@/, "")
    .split("/")[0];

  console.error("");
  console.error("🛑 운영 DB 로 판정되어 중단합니다.");
  console.error(`   대상 host : ${host}`);
  console.error(`   차단 명령 : ${label}`);
  console.error("");
  console.error("   개발 명령(migrate dev / db push 등)은 운영 DB 에서 실행할 수 없습니다.");
  console.error("   · 개발 작업이면 .env 를 개발 DB 로 바꾸십시오 (§dev-prod-db-separation).");
  console.error("   · 운영 적용이면 `npm run prisma:migrate`(migrate deploy) 를 쓰십시오.");
  console.error("     DIRECT_URL(5432) 필수 — DEV_RUNBOOK §9.9.");
  console.error("");
  process.exit(1);
}

console.log(`✅ 개발 DB 확인 — ${label} 진행`);
