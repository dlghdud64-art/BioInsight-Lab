# Supabase Connection String 찾기 가이드

## 현재 확인된 사항
- ✅ 프로젝트 상태: 활성화됨 (FREE 플랜)
- ✅ Database Settings 페이지 접근 가능

## Connection String 찾는 방법

### 방법 1: Database Settings에서
1. **Settings** → **Database** (현재 페이지)
2. **Connection Pooling** 섹션 찾기
3. **"Connection String"** 탭 클릭 (또는 "Connection Info" 탭)
4. Method 드롭다운에서 선택:
   - **Transaction pooler** → DATABASE_URL용
   - **Direct connection** → DIRECT_URL용

### 방법 2: 프로젝트 홈에서
1. Supabase 대시보드 홈으로 이동
2. 왼쪽 사이드바에서 **"Project Settings"** 클릭
3. **"Database"** 섹션으로 스크롤
4. **"Connection string"** 또는 **"Connection pooling"** 섹션 찾기

### 방법 3: API Settings에서
1. **Settings** → **API**
2. **"Database URL"** 또는 **"Connection string"** 섹션 확인

## 필요한 정보

### DATABASE_URL (Transaction pooler)
- Method: **Transaction pooler**
- 포트: **6543**
- 형식: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`

### DIRECT_URL (Direct connection)
- Method: **Direct connection**
- 포트: **5432**
- 형식: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`

## 확인 후 할 일

연결 문자열을 확인하셨다면:
1. `.env.local` 파일 업데이트
2. 연결 테스트 실행: `pnpm db:test`
3. 마이그레이션 실행: `npx prisma migrate dev --name guest_quote_list_p0`










