# BioInsight Lab - Web Application

바이오·제약 분야 시약, 기구, 장비 비교 및 견적 플랫폼의 웹 애플리케이션입니다.

## 기술 스택

- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Forms**: react-hook-form + zod
- **Tables**: TanStack Table
- **Charts**: recharts
- **Database**: PostgreSQL + Prisma
- **Language**: TypeScript

## 시작하기

### 필수 요구사항

- Node.js 18+
- PostgreSQL
- pnpm (권장) 또는 npm

### 설치

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env
# DATABASE_URL을 설정하세요

# 데이터베이스 마이그레이션
pnpm prisma migrate dev

# 개발 서버 실행
pnpm dev
```

## 프로젝트 구조

```
apps/web/
├── src/
│   ├── app/              # Next.js App Router 페이지
│   │   ├── page.tsx      # 홈 페이지
│   │   ├── search/       # 검색 페이지
│   │   ├── products/     # 제품 상세 페이지
│   │   └── compare/      # 비교 페이지
│   ├── components/       # React 컴포넌트
│   │   └── ui/           # shadcn/ui 컴포넌트
│   ├── lib/              # 유틸리티 함수
│   └── types/            # TypeScript 타입 정의
├── prisma/
│   └── schema.prisma     # Prisma 스키마
└── public/               # 정적 파일
```

## 주요 기능 (MVP)

1. ✅ 기본 프로젝트 설정
2. ✅ Prisma 스키마 설계
3. ✅ 기본 UI 컴포넌트 (shadcn/ui)
4. ✅ 홈 페이지 레이아웃
5. ⏳ 제품 검색 기능
6. ⏳ GPT 기반 검색 의도 분류
7. ⏳ 제품 상세 페이지
8. ⏳ 제품 비교 기능
9. ⏳ 견적 요청 기능
10. ⏳ 사용자 인증

## 다음 단계

1. Prisma Client 생성 및 데이터베이스 연결 설정
2. API Route Handlers 구현
3. 검색 기능 구현 (텍스트 검색 + 벡터 검색)
4. AI 통합 (GPT API 연동)
5. 사용자 인증 구현
6. 제품 비교 테이블 구현
7. 견적 요청 시스템 구현

## 개발 가이드

### 컴포넌트 추가

shadcn/ui 컴포넌트를 추가하려면:

```bash
npx shadcn@latest add [component-name]
```

### 데이터베이스 마이그레이션

```bash
# 새 마이그레이션 생성
pnpm db:migrate

# Prisma Client 재생성
pnpm db:generate

# Prisma Studio 실행 (데이터베이스 GUI)
pnpm db:studio
```

### 타입 생성

Prisma Client를 생성하면 자동으로 타입이 생성됩니다:

```bash
pnpm prisma generate
```

## 환경 변수

### 로컬 개발용 (.env.local)

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Database (로컬 PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/ai-biocompare?schema=public"

# OpenAI API (for AI features)
OPENAI_API_KEY="your-openai-api-key"

# App URL (로컬 개발)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

# NextAuth 시크릿 (로컬 개발용)
AUTH_SECRET="local-development-secret-key"
# 또는
NEXTAUTH_SECRET="local-development-secret-key"

# Optional: Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: Email service (for quote notifications)
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="noreply@bioinsightlab.com"

# Optional: Exchange rate API
EXCHANGE_RATE_API_KEY="your-exchange-rate-api-key"

# Optional: PDF 모드 설정
PDF_MODE="paste-only"  # 또는 "upload"
```

### Vercel 배포용

Vercel 대시보드의 "Environment Variables" 탭에서 다음 변수들을 설정하세요:

**필수:**
- `DATABASE_URL`: 클라우드 PostgreSQL 연결 문자열 (Supabase/Neon/Vercel Postgres)
- `NEXTAUTH_URL`: 배포된 도메인 (예: `https://your-project.vercel.app`) 또는 `VERCEL_URL` 자동 감지 사용
- `AUTH_SECRET` 또는 `NEXTAUTH_SECRET`: 랜덤 32바이트 문자열
- `OPENAI_API_KEY`: OpenAI API 키

**선택:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth 사용 시
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`: 이메일 발송 기능 사용 시
- `EXCHANGE_RATE_API_KEY`: 다중 통화 지원 시
- `PDF_MODE`: PDF 처리 모드 설정

**참고:**
- Vercel에서는 `VERCEL_URL` 환경 변수가 자동으로 설정되며, `getAppUrl()` 함수가 이를 활용합니다.
- `NEXTAUTH_URL`을 설정하지 않으면 `VERCEL_URL`을 기반으로 자동 감지됩니다.

## 라이선스

ISC

# 개발 서버 실행
pnpm dev
```

## 프로젝트 구조

```
apps/web/
├── src/
│   ├── app/              # Next.js App Router 페이지
│   │   ├── page.tsx      # 홈 페이지
│   │   ├── search/       # 검색 페이지
│   │   ├── products/     # 제품 상세 페이지
│   │   └── compare/      # 비교 페이지
│   ├── components/       # React 컴포넌트
│   │   └── ui/           # shadcn/ui 컴포넌트
│   ├── lib/              # 유틸리티 함수
│   └── types/            # TypeScript 타입 정의
├── prisma/
│   └── schema.prisma     # Prisma 스키마
└── public/               # 정적 파일
```

## 주요 기능 (MVP)

1. ✅ 기본 프로젝트 설정
2. ✅ Prisma 스키마 설계
3. ✅ 기본 UI 컴포넌트 (shadcn/ui)
4. ✅ 홈 페이지 레이아웃
5. ⏳ 제품 검색 기능
6. ⏳ GPT 기반 검색 의도 분류
7. ⏳ 제품 상세 페이지
8. ⏳ 제품 비교 기능
9. ⏳ 견적 요청 기능
10. ⏳ 사용자 인증

## 다음 단계

1. Prisma Client 생성 및 데이터베이스 연결 설정
2. API Route Handlers 구현
3. 검색 기능 구현 (텍스트 검색 + 벡터 검색)
4. AI 통합 (GPT API 연동)
5. 사용자 인증 구현
6. 제품 비교 테이블 구현
7. 견적 요청 시스템 구현

## 개발 가이드

### 컴포넌트 추가

shadcn/ui 컴포넌트를 추가하려면:

```bash
npx shadcn@latest add [component-name]
```

### 데이터베이스 마이그레이션

```bash
# 새 마이그레이션 생성
pnpm db:migrate

# Prisma Client 재생성
pnpm db:generate

# Prisma Studio 실행 (데이터베이스 GUI)
pnpm db:studio
```

### 타입 생성

Prisma Client를 생성하면 자동으로 타입이 생성됩니다:

```bash
pnpm prisma generate
```

## 환경 변수

### 로컬 개발용 (.env.local)

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Database (로컬 PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/ai-biocompare?schema=public"

# OpenAI API (for AI features)
OPENAI_API_KEY="your-openai-api-key"

# App URL (로컬 개발)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

# NextAuth 시크릿 (로컬 개발용)
AUTH_SECRET="local-development-secret-key"
# 또는
NEXTAUTH_SECRET="local-development-secret-key"

# Optional: Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: Email service (for quote notifications)
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="noreply@bioinsightlab.com"

# Optional: Exchange rate API
EXCHANGE_RATE_API_KEY="your-exchange-rate-api-key"

# Optional: PDF 모드 설정
PDF_MODE="paste-only"  # 또는 "upload"
```

### Vercel 배포용

Vercel 대시보드의 "Environment Variables" 탭에서 다음 변수들을 설정하세요:

**필수:**
- `DATABASE_URL`: 클라우드 PostgreSQL 연결 문자열 (Supabase/Neon/Vercel Postgres)
- `NEXTAUTH_URL`: 배포된 도메인 (예: `https://your-project.vercel.app`) 또는 `VERCEL_URL` 자동 감지 사용
- `AUTH_SECRET` 또는 `NEXTAUTH_SECRET`: 랜덤 32바이트 문자열
- `OPENAI_API_KEY`: OpenAI API 키

**선택:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth 사용 시
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`: 이메일 발송 기능 사용 시
- `EXCHANGE_RATE_API_KEY`: 다중 통화 지원 시
- `PDF_MODE`: PDF 처리 모드 설정

**참고:**
- Vercel에서는 `VERCEL_URL` 환경 변수가 자동으로 설정되며, `getAppUrl()` 함수가 이를 활용합니다.
- `NEXTAUTH_URL`을 설정하지 않으면 `VERCEL_URL`을 기반으로 자동 감지됩니다.

## 라이선스

ISC

# 개발 서버 실행
pnpm dev
```

## 프로젝트 구조

```
apps/web/
├── src/
│   ├── app/              # Next.js App Router 페이지
│   │   ├── page.tsx      # 홈 페이지
│   │   ├── search/       # 검색 페이지
│   │   ├── products/     # 제품 상세 페이지
│   │   └── compare/      # 비교 페이지
│   ├── components/       # React 컴포넌트
│   │   └── ui/           # shadcn/ui 컴포넌트
│   ├── lib/              # 유틸리티 함수
│   └── types/            # TypeScript 타입 정의
├── prisma/
│   └── schema.prisma     # Prisma 스키마
└── public/               # 정적 파일
```

## 주요 기능 (MVP)

1. ✅ 기본 프로젝트 설정
2. ✅ Prisma 스키마 설계
3. ✅ 기본 UI 컴포넌트 (shadcn/ui)
4. ✅ 홈 페이지 레이아웃
5. ⏳ 제품 검색 기능
6. ⏳ GPT 기반 검색 의도 분류
7. ⏳ 제품 상세 페이지
8. ⏳ 제품 비교 기능
9. ⏳ 견적 요청 기능
10. ⏳ 사용자 인증

## 다음 단계

1. Prisma Client 생성 및 데이터베이스 연결 설정
2. API Route Handlers 구현
3. 검색 기능 구현 (텍스트 검색 + 벡터 검색)
4. AI 통합 (GPT API 연동)
5. 사용자 인증 구현
6. 제품 비교 테이블 구현
7. 견적 요청 시스템 구현

## 개발 가이드

### 컴포넌트 추가

shadcn/ui 컴포넌트를 추가하려면:

```bash
npx shadcn@latest add [component-name]
```

### 데이터베이스 마이그레이션

```bash
# 새 마이그레이션 생성
pnpm db:migrate

# Prisma Client 재생성
pnpm db:generate

# Prisma Studio 실행 (데이터베이스 GUI)
pnpm db:studio
```

### 타입 생성

Prisma Client를 생성하면 자동으로 타입이 생성됩니다:

```bash
pnpm prisma generate
```

## 환경 변수

### 로컬 개발용 (.env.local)

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Database (로컬 PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/ai-biocompare?schema=public"

# OpenAI API (for AI features)
OPENAI_API_KEY="your-openai-api-key"

# App URL (로컬 개발)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

# NextAuth 시크릿 (로컬 개발용)
AUTH_SECRET="local-development-secret-key"
# 또는
NEXTAUTH_SECRET="local-development-secret-key"

# Optional: Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: Email service (for quote notifications)
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="noreply@bioinsightlab.com"

# Optional: Exchange rate API
EXCHANGE_RATE_API_KEY="your-exchange-rate-api-key"

# Optional: PDF 모드 설정
PDF_MODE="paste-only"  # 또는 "upload"
```

### Vercel 배포용

Vercel 대시보드의 "Environment Variables" 탭에서 다음 변수들을 설정하세요:

**필수:**
- `DATABASE_URL`: 클라우드 PostgreSQL 연결 문자열 (Supabase/Neon/Vercel Postgres)
- `NEXTAUTH_URL`: 배포된 도메인 (예: `https://your-project.vercel.app`) 또는 `VERCEL_URL` 자동 감지 사용
- `AUTH_SECRET` 또는 `NEXTAUTH_SECRET`: 랜덤 32바이트 문자열
- `OPENAI_API_KEY`: OpenAI API 키

**선택:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth 사용 시
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`: 이메일 발송 기능 사용 시
- `EXCHANGE_RATE_API_KEY`: 다중 통화 지원 시
- `PDF_MODE`: PDF 처리 모드 설정

**참고:**
- Vercel에서는 `VERCEL_URL` 환경 변수가 자동으로 설정되며, `getAppUrl()` 함수가 이를 활용합니다.
- `NEXTAUTH_URL`을 설정하지 않으면 `VERCEL_URL`을 기반으로 자동 감지됩니다.

## 라이선스

ISC
