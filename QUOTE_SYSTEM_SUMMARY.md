# Quote System Implementation Summary

## 완료 사항

### 1. Prisma 스키마 업데이트 ✅
- **Quote 모델**: guestKey, currency, totalAmount 필드 추가
- **QuoteListItem 모델**: draft items 지원 (productId nullable, 비정규화 필드 추가)
- **QuoteVendor 모델**: 새로 생성 (벤더 정보 저장)
- **QuoteShare 모델**: 새로 생성 (공개 공유용, Phase B)

**위치:** `apps/web/prisma/schema.prisma`

### 2. 데이터베이스 마이그레이션 ✅
- 마이그레이션 파일 생성: `20251227_add_quote_guest_support`
- RLS 정책 SQL 작성 (Supabase용)

**위치:**
- `apps/web/prisma/migrations/20251227_add_quote_guest_support/migration.sql`
- `apps/web/prisma/migrations/20251227_add_quote_guest_support/rls_policies.sql`

### 3. API 라우트 구현 ✅

#### POST /api/quotes
- 인증 사용자 + 게스트 사용자 지원
- guestKey 자동 생성/조회 (쿠키 기반)
- Items 배열로 견적 생성

#### GET /api/quotes/:id
- 소유자 또는 guestKey 일치 검증
- X-Guest-Key 헤더 지원

#### PATCH /api/quotes/:id
- title, description, status, items 업데이트
- items 전체 교체 방식 (upsert)
- totalAmount 자동 재계산

#### GET /api/quotes
- 현재 사용자/게스트의 견적 목록 조회

**위치:**
- `apps/web/src/app/api/quotes/route.new.ts` (새 구현)
- `apps/web/src/app/api/quotes/[id]/route.new.ts` (새 구현)

### 4. Supabase RLS 정책 ✅
- Quote, QuoteListItem, QuoteVendor, QuoteShare 테이블 RLS 활성화
- Authenticated users: userId 기반 접근 제어
- Guest users: API 라우트 전용 (service role key 사용)

**위치:** `apps/web/prisma/migrations/20251227_add_quote_guest_support/rls_policies.sql`

### 5. 클라이언트 API 유틸리티 ✅
- createQuote, getQuote, updateQuote, deleteQuote, getQuotes 함수
- TypeScript 타입 정의 포함

**위치:** `apps/web/src/lib/api/quotes-client.ts`

### 6. 문서화 ✅
- 상세 구현 가이드 작성
- 마이그레이션 체크리스트
- UI 연동 가이드
- 보안 고려사항

**위치:** `apps/web/QUOTE_IMPLEMENTATION_GUIDE.md`

---

## 다음 단계 (실제 적용)

### 1. 환경 설정
```bash
cd apps/web

# DATABASE_URL 설정 (.env 파일)
echo 'DATABASE_URL="postgresql://..."' > .env

# 의존성 설치
npm install
```

### 2. 마이그레이션 적용
```bash
# Prisma 클라이언트 생성
npm run db:generate

# 마이그레이션 실행
npm run db:migrate

# (Supabase 환경) RLS 정책 적용
# Supabase SQL Editor에서 rls_policies.sql 실행
```

### 3. API 라우트 교체
```bash
# 기존 파일 백업
mv src/app/api/quotes/route.ts src/app/api/quotes/route.backup.ts
mv src/app/api/quotes/[id]/route.ts src/app/api/quotes/[id]/route.backup.ts

# 새 구현으로 교체
mv src/app/api/quotes/route.new.ts src/app/api/quotes/route.ts
mv src/app/api/quotes/[id]/route.new.ts src/app/api/quotes/[id]/route.ts
```

### 4. /test/quote UI 연동
- `apps/web/src/app/test/quote/page.tsx` 수정
- `apps/web/src/app/test/_components/quote-panel.tsx` 수정
- 저장 버튼 추가, URL 파라미터 처리, 토스트 메시지 추가

**참고:** `QUOTE_IMPLEMENTATION_GUIDE.md` 의 "6. /test/quote UI 연동 가이드" 섹션

### 5. 테스트
- [ ] Guest로 견적 생성
- [ ] 인증 사용자로 견적 생성
- [ ] 견적 수정 (items 교체)
- [ ] 견적 삭제
- [ ] 브라우저 재시작 후 견적 조회

---

## 주요 특징

### guestKey 인증
- 쿠키 기반 (`bil_guest`)
- 30일 유효기간
- HttpOnly, SameSite, Secure 설정
- X-Guest-Key 헤더 지원

### 보안
- **RLS 활성화**: DB 레벨 접근 제어
- **서버 검증**: Guest 작업은 API 라우트에서만 처리
- **Service Role Key**: RLS 우회는 서버에서만

### 확장성
- QuoteVendor: 벤더 정보 관리 (Phase B)
- QuoteShare: 공개 공유 기능 (Phase B)
- Draft items: productId 없이도 견적 생성 가능

---

## 기술 스택

- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma 5.22.0
- **Backend**: Next.js 14 API Routes
- **Frontend**: React + TypeScript
- **Authentication**: NextAuth v5

---

## 파일 구조

```
apps/web/
├── prisma/
│   ├── schema.prisma (업데이트됨)
│   └── migrations/
│       └── 20251227_add_quote_guest_support/
│           ├── migration.sql
│           └── rls_policies.sql
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── quotes/
│   │   │       ├── route.new.ts (새 구현)
│   │   │       └── [id]/
│   │   │           └── route.new.ts (새 구현)
│   │   └── test/
│   │       └── quote/
│   │           └── page.tsx (연동 필요)
│   └── lib/
│       └── api/
│           ├── quotes-client.ts (새 파일)
│           └── guest-key.ts (기존 파일)
├── QUOTE_IMPLEMENTATION_GUIDE.md (상세 가이드)
└── .env (설정 필요)
```

---

## 문의

구현 관련 질문이나 이슈는 프로젝트 이슈 트래커에 등록해주세요.

**구현일**: 2025-12-27
**상태**: ✅ 구현 완료 (적용 대기)
