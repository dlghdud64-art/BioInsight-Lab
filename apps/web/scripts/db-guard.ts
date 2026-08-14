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

/**
 * 🛑 **가장 위험한 값으로 판정한다** (2026-08-12 사고로 교정).
 *
 * 이전에는 `.env` 만 읽었다. 근거는 "Prisma CLI 와 동일 동작" 이었다.
 * 그런데 **Next.js 앱은 `.env.local` 을 `.env` 보다 우선**한다.
 *
 * 실제로 일어난 일: `.env` 를 개발 DB 로 바꾸고 가드가 통과했는데,
 * `.env.local` 에 운영 DB 가 남아 있어 **앱은 여전히 운영에 붙어 있었다.**
 * 가드가 **거짓 안심**을 준 것이다 — 가입 시도 직전에 발견했다.
 *
 * 그래서 이 가드는 **Next 의 로드 순서(.env.local > .env)를 재현**하고,
 * 두 파일에서 나온 값 중 **하나라도 운영이면 차단**한다(fail-closed).
 * Prisma 는 `.env` 만 보지만, 이 가드가 지키려는 것은 "이 저장소에서 어떤 명령을
 * 돌렸을 때 운영이 위험한가" 이지 Prisma 의 동작 재현이 아니다.
 *
 * 규칙: **환경 의존 판정은 런타임과 같은 로더로 측정한다.**
 */
loadEnv({ path: ".env" });

// .env.local 을 나중에, override 로 읽어 Next 의 우선순위를 재현한다.
const localEnv: Record<string, string> = {};
loadEnv({ path: ".env.local", processEnv: localEnv as NodeJS.ProcessEnv });

/**
 * `.env` 값과 `.env.local` 값 **둘 다** 검사한다 — 하나라도 운영이면 차단.
 * ⚠️ **어느 파일이 문제인지 함께 돌려준다.** 막기만 하고 틀린 host 를 보여주면
 *    사람을 엉뚱한 파일로 보낸다(첫 구현이 그랬다).
 */
function anyEnvIsProduction(): { blocked: boolean; source?: string; host?: string } {
  const hostOf = () =>
    (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").replace(/^.*@/, "").split("/")[0];
  if (isProductionDatabase()) return { blocked: true, source: ".env", host: hostOf() };
  const saved = {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    DEV_DATABASE_PROJECT_REF: process.env.DEV_DATABASE_PROJECT_REF,
  };
  try {
    // .env.local 이 실제로 덮는 값만 반영해서 재판정
    for (const k of Object.keys(saved) as (keyof typeof saved)[]) {
      if (localEnv[k] !== undefined) process.env[k] = localEnv[k];
    }
    if (isProductionDatabase()) {
      return { blocked: true, source: ".env.local", host: hostOf() };
    }
    return { blocked: false };
  } finally {
    for (const k of Object.keys(saved) as (keyof typeof saved)[]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
  }
}

const label = process.argv[2] ?? "prisma 개발 명령";

const verdict = anyEnvIsProduction();

if (verdict.blocked) {
  console.error("");
  console.error("🛑 운영 DB 로 판정되어 중단합니다.");
  console.error(`   문제 파일 : ${verdict.source}`);
  console.error(`   대상 host : ${verdict.host}`);
  console.error(`   차단 명령 : ${label}`);
  console.error("");
  console.error("   개발 명령(migrate dev / db push 등)은 운영 DB 에서 실행할 수 없습니다.");
  console.error("   · 개발 작업이면 .env **와 .env.local 둘 다** 개발 DB 로 바꾸십시오");
  console.error("     (§dev-prod-db-separation — Next 는 .env.local 을 우선한다).");
  console.error("   · 운영 적용이면 `npm run prisma:migrate`(migrate deploy) 를 쓰십시오.");
  console.error("     DIRECT_URL(5432) 필수 — DEV_RUNBOOK §9.9.");
  console.error("");
  process.exit(1);
}

console.log(`✅ 개발 DB 확인 — ${label} 진행`);
