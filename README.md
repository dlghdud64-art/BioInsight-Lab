This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Vercel 배포 가이드

이 프로젝트를 Vercel에 배포하여 동료들과 데모를 공유할 수 있습니다.

### 1. 사전 준비

#### 1.1 GitHub 저장소에 푸시

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

#### 1.2 데이터베이스 설정

프로젝트는 PostgreSQL을 사용합니다. Vercel 배포를 위해 클라우드 PostgreSQL 서비스를 사용하세요:

- **Supabase** (추천): https://supabase.com
- **Neon**: https://neon.tech
- **Vercel Postgres**: Vercel 대시보드에서 직접 생성 가능

데이터베이스 생성 후 연결 문자열을 복사해두세요.

### 2. Vercel 배포

#### 2.1 새 프로젝트 생성

1. [Vercel Dashboard](https://vercel.com/dashboard)에 로그인
2. "Add New..." → "Project" 클릭
3. GitHub 저장소 선택 및 Import

#### 2.2 프로젝트 설정

Vercel이 자동으로 Next.js를 감지합니다. 다음 설정을 확인하세요:

- **Framework Preset**: Next.js (자동 감지)
- **Root Directory**: `apps/web` (monorepo인 경우)
- **Build Command**: `npm run build` (기본값 사용)
- **Output Directory**: `.next` (기본값 사용)
- **Install Command**: `npm install` (기본값 사용)

#### 2.3 환경 변수 설정

Vercel 프로젝트 설정의 "Environment Variables" 탭에서 다음 변수들을 추가하세요:

**필수 환경 변수:**

```env
# 데이터베이스 연결 (PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# 앱 URL (Vercel이 자동으로 설정하지만, 필요시 수동 설정)
NEXTAUTH_URL="https://your-project.vercel.app"
# 또는 VERCEL_URL을 사용하면 자동 감지됩니다

# NextAuth 시크릿 (랜덤 32바이트 문자열)
AUTH_SECRET="your-random-32-byte-secret"
# 또는
NEXTAUTH_SECRET="your-random-32-byte-secret"

# OpenAI API 키 (AI 기능 사용 시)
OPENAI_API_KEY="sk-..."
```

**선택적 환경 변수:**

```env
# Google OAuth (로그인 기능 사용 시)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# 이메일 발송 (SendGrid)
SENDGRID_API_KEY="SG..."
SENDGRID_FROM_EMAIL="noreply@bioinsightlab.com"

# 환율 API (다중 통화 지원 시)
EXCHANGE_RATE_API_KEY="your-api-key"

# PDF 모드 설정
PDF_MODE="paste-only"  # 또는 "upload"
```

**시크릿 생성 방법:**

```bash
# Node.js에서 시크릿 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 2.4 배포 실행

"Deploy" 버튼을 클릭하여 배포를 시작합니다.

### 3. 배포 후 작업

#### 3.1 데이터베이스 마이그레이션

첫 배포 후, Vercel 대시보드의 "Functions" 탭에서 또는 로컬에서 다음 명령어를 실행하세요:

```bash
# Vercel CLI 사용 (권장)
vercel env pull .env.local
npx prisma migrate deploy
npx prisma db seed
```

또는 Vercel 대시보드의 "Deployments" 탭에서 특정 배포의 "..." 메뉴 → "Redeploy" 후, 빌드 로그에서 확인하세요.

#### 3.2 시드 데이터 (선택)

더미 데이터가 필요하면:

```bash
npm run prisma:seed
```

### 4. 데모 모드

데이터베이스 연결이 실패하거나 `DEMO_MODE=true`로 설정된 경우, 앱은 데모 모드로 작동합니다:

- 읽기 작업은 샘플 데이터를 반환
- 쓰기 작업은 더미 응답을 반환하며 "데모 환경에서는 실제 저장되지 않습니다" 메시지 표시
- 전체 UI/플로우는 정상 작동

### 5. 트러블슈팅

#### 빌드 실패

- **Prisma Client 오류**: `npm run build`가 `prisma generate`를 포함하는지 확인
- **TypeScript 오류**: `tsconfig.json` 설정 확인 및 타입 에러 수정

#### 런타임 오류

- **데이터베이스 연결 실패**: `DATABASE_URL` 확인 및 네트워크 설정 확인
- **환경 변수 누락**: Vercel 대시보드에서 모든 필수 환경 변수가 설정되었는지 확인

#### 로컬과 다른 동작

- **URL 문제**: `NEXTAUTH_URL` 또는 `VERCEL_URL` 자동 감지 확인
- **이미지 로드 실패**: `next.config.ts`의 `remotePatterns` 설정 확인

### 6. 추가 리소스

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
