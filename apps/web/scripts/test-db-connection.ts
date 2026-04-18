/**
 * 데이터베이스 연결 테스트 스크립트
 * 실행: tsx scripts/test-db-connection.ts
 */

import { PrismaClient } from "@prisma/client";

async function testConnection() {
  console.log("🔍 데이터베이스 연결 테스트 시작...\n");

  // 환경 변수 확인
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  console.log("📋 환경 변수 확인:");
  console.log(`  DATABASE_URL: ${databaseUrl ? "✅ 설정됨" : "❌ 설정되지 않음"}`);
  console.log(`  DIRECT_URL: ${directUrl ? "✅ 설정됨" : "⚠️  설정되지 않음 (선택사항)"}\n`);

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL이 설정되지 않았습니다.");
    console.error("   .env.local 파일에 DATABASE_URL을 설정해주세요.");
    console.error("   예: DATABASE_URL=\"postgresql://user:password@localhost:5432/ai-biocompare?schema=public\"");
    process.exit(1);
  }

  // 먼저 DATABASE_URL로 테스트 (Transaction pooler)
  console.log("🔌 DATABASE_URL로 연결 테스트 중...");
  const prismaPooler = new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  let poolerConnected = false;
  try {
    await prismaPooler.$connect();
    console.log("✅ DATABASE_URL 연결 성공!\n");
    poolerConnected = true;
    
    // DATABASE_URL로 간단한 연결 테스트만 수행
    // (Transaction pooler는 prepared statement 제한이 있어서 복잡한 쿼리는 실패할 수 있음)
    console.log("  ✅ 연결 성공 - 데이터베이스 사용 가능\n");
    
    await prismaPooler.$disconnect();
  } catch (error: any) {
    console.log(`⚠️  DATABASE_URL 연결 실패: ${error.message}\n`);
  }

  // DIRECT_URL로 테스트 (Direct connection)
  if (!directUrl) {
    console.log("⚠️  DIRECT_URL이 설정되지 않았습니다. 마이그레이션을 실행하려면 필요합니다.\n");
  } else {
    console.log("🔌 DIRECT_URL로 연결 테스트 중...");
    const prisma = new PrismaClient({
      log: ["error", "warn"],
      datasources: {
        db: {
          url: directUrl,
        },
      },
    });

    try {
      await prisma.$connect();
      console.log("✅ DIRECT_URL 연결 성공!\n");

      // 데이터베이스 정보 확인
      console.log("📊 데이터베이스 정보:");
      const result = await prisma.$queryRaw`SELECT version() as version`;
      console.log(`  PostgreSQL 버전: ${(result as any)[0]?.version || "확인 불가"}\n`);

      // 테이블 존재 여부 확인
      console.log("📋 테이블 확인:");
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `;
      
      if (tables.length === 0) {
        console.log("  ⚠️  테이블이 없습니다. 마이그레이션을 실행해주세요:");
        console.log("     pnpm db:migrate");
      } else {
        console.log(`  ✅ ${tables.length}개의 테이블 발견:`);
        tables.forEach((table) => {
          console.log(`     - ${table.tablename}`);
        });
      }

      console.log("\n✅ 모든 테스트 통과!");
      await prisma.$disconnect();
    } catch (error: any) {
      console.error("\n❌ DIRECT_URL 연결 실패:");
      console.error(`   오류: ${error.message}\n`);

      if (error.code === "P1001") {
        console.error("💡 해결 방법:");
        console.error("   1. Supabase 대시보드에서 데이터베이스가 활성화되어 있는지 확인");
        console.error("   2. DIRECT_URL의 호스트, 포트(5432), 데이터베이스 이름을 확인");
        console.error("   3. 비밀번호가 올바른지 확인 (특수문자는 URL 인코딩 필요)");
        console.error("   4. Supabase 프로젝트가 일시 중지되지 않았는지 확인");
        console.error("   5. 방화벽이나 네트워크 설정 확인");
      } else if (error.code === "P1003") {
        console.error("💡 해결 방법:");
        console.error("   데이터베이스가 존재하지 않습니다.");
      }

      process.exit(1);
    }
  }

  console.log("\n🔌 연결 종료");
}

testConnection();

