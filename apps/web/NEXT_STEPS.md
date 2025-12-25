# 다음 단계 가이드

## 현재 상태
- ✅ Prisma 스키마 준비됨
- ✅ 환경 변수 파일 존재 (.env.local)
- ⚠️ 데이터베이스 연결 설정 필요 (Supabase)

## 다음 해야 할 일

### 1️⃣ Supabase에서 연결 문자열 복사

Supabase 대시보드에서:

1. **Settings** → **Database** → **Connection Pooling** 이동
2. **두 개의 연결 문자열** 복사:

   **a) DATABASE_URL (Transaction pooler)**
   - Method: **"Transaction pooler"** 선택
   - 포트: **6543**
   - 연결 문자열 복사

   **b) DIRECT_URL (Direct connection)**
   - Method: **"Direct connection"** 선택  
   - 포트: **5432**
   - 연결 문자열 복사

### 2️⃣ .env.local 파일 수정

`apps/web/.env.local` 파일을 열고 다음 형식으로 설정:

```env
# DATABASE_URL: Transaction pooler (애플리케이션 런타임용)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public"

# DIRECT_URL: Direct connection (마이그레이션/스튜디오용)
DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?schema=public"
```

**중요:**
- `[project-ref]`, `[password]`, `[region]` 부분을 실제 값으로 교체
- 비밀번호에 특수문자가 있으면 URL 인코딩 필요 (`@` → `%40`, `#` → `%23` 등)

### 3️⃣ 연결 테스트

```bash
cd apps/web
pnpm db:test
```

✅ "데이터베이스 연결 성공!" 메시지가 나오면 다음 단계로 진행

### 4️⃣ 마이그레이션 실행

데이터베이스 스키마를 생성합니다:

```bash
cd apps/web
pnpm db:migrate
```

또는:

```bash
cd apps/web
npx prisma migrate dev
```

**예상 결과:**
- 마이그레이션 파일 생성
- 데이터베이스에 테이블 생성
- "Migration applied successfully" 메시지

### 5️⃣ Prisma Client 재생성 (필요시)

마이그레이션 후 Prisma Client를 재생성:

```bash
cd apps/web
pnpm db:generate
```

### 6️⃣ 연결 확인

다시 연결 테스트를 실행하여 테이블이 생성되었는지 확인:

```bash
cd apps/web
pnpm db:test
```

이제 테이블 목록이 표시되어야 합니다.

## 문제 해결

### 연결 실패 시

1. **Supabase 대시보드 확인**
   - 데이터베이스가 활성화되어 있는지 확인
   - 비밀번호가 올바른지 확인

2. **환경 변수 확인**
   - `.env.local` 파일이 올바른 위치에 있는지 확인 (`apps/web/.env.local`)
   - 연결 문자열 형식이 올바른지 확인

3. **네트워크 확인**
   - 방화벽이 연결을 차단하지 않는지 확인
   - Supabase 프로젝트가 일시 중지되지 않았는지 확인

### 마이그레이션 실패 시

1. **DIRECT_URL 확인**
   - Direct connection을 사용하고 있는지 확인
   - 포트가 5432인지 확인

2. **Prisma 버전 확인**
   ```bash
   npx prisma --version
   ```

3. **수동 마이그레이션**
   - Supabase SQL Editor에서 직접 SQL 실행 가능
   - `apps/web/prisma/migrations/` 폴더의 SQL 파일 확인

## 완료 후 확인 사항

- [ ] DATABASE_URL 설정 완료 (Transaction pooler)
- [ ] DIRECT_URL 설정 완료 (Direct connection)
- [ ] 연결 테스트 성공
- [ ] 마이그레이션 실행 완료
- [ ] 테이블 생성 확인
- [ ] Prisma Client 생성 완료

## 추가 리소스

- `SUPABASE_CONNECTION_GUIDE.md` - Supabase 연결 풀러 상세 가이드
- `DATABASE_CONNECTION_STATUS.md` - 현재 연결 상태
- [Prisma 공식 문서](https://www.prisma.io/docs)
- [Supabase 공식 문서](https://supabase.com/docs)









