# Supabase 연결 풀러 설정 가이드

## 📋 Prisma + Supabase 권장 설정

Prisma를 사용할 때는 **두 가지 연결 문자열**이 필요합니다:

### 1. DATABASE_URL (애플리케이션 런타임용)
- **풀러 선택: Transaction pooler** ✅ 권장
- **포트: 6543** (Transaction pooler 포트)
- **용도**: Next.js 애플리케이션의 일반 쿼리 실행

**이유:**
- Prisma는 트랜잭션 기반으로 작동
- Transaction pooler가 Prisma의 쿼리 패턴에 가장 적합
- 연결 수를 효율적으로 관리하여 성능 최적화

### 2. DIRECT_URL (마이그레이션/스튜디오용)
- **풀러 선택: Direct connection** ✅ 필수
- **포트: 5432** (직접 연결 포트)
- **용도**: `prisma migrate`, `prisma studio`, `prisma db pull` 등

**이유:**
- 마이그레이션은 직접 연결이 필요 (풀러를 통하면 제한사항 발생)
- Prisma Studio는 세션 기반으로 작동하므로 직접 연결 필요
- 스키마 인트로스펙션도 직접 연결 필요

## 🔧 Supabase 대시보드에서 설정하기

### Step 1: DATABASE_URL 설정 (Transaction pooler)

1. Supabase 대시보드 → **Settings** → **Database**
2. **Connection Pooling** 섹션으로 이동
3. **Connection String** 탭 선택
4. **Method**에서 **"Transaction pooler"** 선택
5. 연결 문자열 복사

**형식:**
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Step 2: DIRECT_URL 설정 (Direct connection)

1. 같은 페이지에서 **Method**를 **"Direct connection"**으로 변경
2. 연결 문자열 복사

**형식:**
```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

## 📝 .env.local 파일 설정 예시

```env
# DATABASE_URL: Transaction pooler 사용 (애플리케이션 런타임)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public"

# DIRECT_URL: Direct connection 사용 (마이그레이션/스튜디오)
DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?schema=public"
```

## ⚠️ 주의사항

### Transaction pooler vs Session pooler

- **Transaction pooler** (권장): Prisma에 최적화
  - 각 쿼리를 독립적인 트랜잭션으로 처리
  - Prisma의 쿼리 패턴과 완벽하게 호환
  
- **Session pooler**: 사용하지 않음
  - 세션 기반 연결 관리
  - Prisma와 호환성 문제 발생 가능

### 포트 번호

- **6543**: Transaction pooler 포트
- **5432**: Direct connection 포트 (PostgreSQL 기본 포트)

## ✅ 설정 확인

설정 후 다음 명령어로 확인:

```bash
# 연결 테스트
pnpm db:test

# 마이그레이션 실행 (DIRECT_URL 사용)
pnpm db:migrate

# Prisma Studio 실행 (DIRECT_URL 사용)
pnpm db:studio
```

## 🔍 문제 해결

### 마이그레이션 실패 시

1. **DIRECT_URL 확인**
   - Direct connection을 사용하고 있는지 확인
   - 포트가 5432인지 확인

2. **네트워크 확인**
   - Supabase 대시보드에서 데이터베이스 상태 확인
   - 방화벽 설정 확인

3. **비밀번호 확인**
   - Supabase 대시보드에서 비밀번호 재설정 가능
   - URL 인코딩 필요 시 특수문자 처리

### 연결 풀러 오류 시

- Transaction pooler 사용 중 오류 발생 시 Direct connection으로 임시 테스트
- Supabase 대시보드에서 연결 풀러 상태 확인

## 📚 참고 자료

- [Prisma 공식 문서 - Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Supabase 공식 문서 - Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)















