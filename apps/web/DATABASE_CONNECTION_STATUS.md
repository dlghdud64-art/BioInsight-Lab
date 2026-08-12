# 데이터베이스 연결 상태

## ✅ 연결 성공

데이터베이스 연결이 성공적으로 설정되었습니다!

### 확인된 사항:
- ✅ DATABASE_URL 환경 변수 설정됨
- ✅ DIRECT_URL 환경 변수 설정됨  
- ✅ PostgreSQL 데이터베이스 연결 성공
- ✅ PostgreSQL 버전: 17.6

### 현재 상태:
- 데이터베이스 연결: **정상**
- 테이블: **없음** (마이그레이션 필요)

## 다음 단계

### 1. 마이그레이션 실행

데이터베이스 스키마를 생성하려면 다음 명령어를 실행하세요:

```bash
cd apps/web
pnpm db:migrate
```

또는 직접 실행:

```bash
cd apps/web
npx prisma migrate dev
```

### 2. 연결 테스트

언제든지 다음 명령어로 데이터베이스 연결을 테스트할 수 있습니다:

```bash
cd apps/web
pnpm db:test
```

### 3. Prisma Studio 실행 (선택사항)

데이터베이스를 시각적으로 관리하려면:

```bash
cd apps/web
pnpm db:studio
```

## 문제 해결

### 마이그레이션 실행 시 연결 오류가 발생하는 경우

Supabase를 사용하는 경우:

1. **DIRECT_URL 확인**
   - `.env.local` 파일에서 `DIRECT_URL`이 올바르게 설정되어 있는지 확인
   - Supabase에서는 연결 풀러 URL과 직접 연결 URL이 다를 수 있습니다
   - 직접 연결 URL 형식: `postgresql://user:password@host:5432/database?schema=public`

2. **네트워크 확인**
   - Supabase 대시보드에서 데이터베이스가 활성화되어 있는지 확인
   - 방화벽이나 네트워크 설정이 연결을 차단하지 않는지 확인

3. **환경 변수 확인**
   ```bash
   # .env.local 파일 예시 (Supabase)
   # DATABASE_URL: Transaction pooler 사용 (포트 6543)
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public"
   
   # DIRECT_URL: Direct connection 사용 (포트 5432)
   DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?schema=public"
   ```
   
   **중요:** 
   - DATABASE_URL은 **Transaction pooler** 사용 (포트 6543)
   - DIRECT_URL은 **Direct connection** 사용 (포트 5432)
   - 자세한 내용은 `SUPABASE_CONNECTION_GUIDE.md` 참고

## 유용한 명령어

```bash
# Prisma Client 재생성
pnpm db:generate

# 마이그레이션 실행
pnpm db:migrate

# 데이터베이스 연결 테스트
pnpm db:test

# Prisma Studio 실행
pnpm db:studio

# 시드 데이터 실행
pnpm db:seed
```

## 참고

- Prisma 스키마 파일: `apps/web/prisma/schema.prisma`
- 데이터베이스 연결 설정: `apps/web/src/lib/db.ts`
- 환경 변수 파일: `apps/web/.env.local`

