# Vercel 배포 체크리스트

## 배포 전 확인 사항

### ✅ 코드 준비
- [x] package.json에 빌드 스크립트 확인
- [x] next.config.ts 설정 확인
- [x] 환경변수 자동 감지 로직 추가 (`getAppUrl()`)
- [x] localhost 참조 제거
- [x] 데모 모드 에러 핸들링 추가
- [x] README에 배포 가이드 추가

### 📝 배포 전 작업

1. **Git 커밋 및 푸시**
   ```bash
   git add .
   git commit -m "feat: Vercel deployment setup"
   git push origin main
   ```

2. **환경변수 준비**
   - [ ] PostgreSQL 데이터베이스 생성 (Supabase/Neon/Vercel Postgres)
   - [ ] DATABASE_URL 복사
   - [ ] AUTH_SECRET 생성: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - [ ] OPENAI_API_KEY 준비

### 🚀 Vercel 배포 단계

1. **프로젝트 생성**
   - [ ] [Vercel Dashboard](https://vercel.com/dashboard) 접속
   - [ ] "Add New..." → "Project" 클릭
   - [ ] GitHub 저장소 선택 및 Import

2. **프로젝트 설정**
   - [ ] Framework Preset: Next.js (자동 감지)
   - [ ] Root Directory: `apps/web` (monorepo이므로 필수!)
   - [ ] Build Command: `npm run build` (기본값)
   - [ ] Output Directory: `.next` (기본값)
   - [ ] Install Command: `npm install` (기본값)

3. **환경변수 설정**
   Vercel 프로젝트 설정 → "Environment Variables" 탭에서 추가:
   
   **필수:**
   - [ ] `DATABASE_URL` = `postgresql://...`
   - [ ] `AUTH_SECRET` = `생성한-32바이트-문자열`
   - [ ] `OPENAI_API_KEY` = `sk-...`
   
   **선택:**
   - [ ] `NEXTAUTH_URL` = `https://your-project.vercel.app` (또는 VERCEL_URL 자동 감지)
   - [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (로그인 사용 시)
   - [ ] `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (이메일 사용 시)

4. **배포 실행**
   - [ ] "Deploy" 버튼 클릭
   - [ ] 빌드 로그 확인

### 📊 배포 후 작업

1. **데이터베이스 마이그레이션**
   ```bash
   # Vercel CLI 설치 (선택)
   npm i -g vercel
   
   # 환경변수 가져오기
   vercel env pull .env.local
   
   # 마이그레이션 실행
   cd apps/web
   npx prisma migrate deploy
   npx prisma db seed
   ```
   
   또는 Vercel 대시보드에서:
   - [ ] "Deployments" → 최신 배포 → "..." → "Redeploy"
   - [ ] 빌드 로그에서 Prisma 마이그레이션 확인

2. **기능 테스트**
   - [ ] 홈 페이지 접속 확인
   - [ ] 검색 기능 테스트
   - [ ] 제품 상세 페이지 확인
   - [ ] 품목 리스트 기능 테스트
   - [ ] 공유 링크 생성 테스트

3. **에러 모니터링**
   - [ ] Vercel 대시보드 → "Functions" 탭에서 에러 로그 확인
   - [ ] 브라우저 콘솔에서 클라이언트 에러 확인

### 🔧 트러블슈팅

**빌드 실패:**
- Prisma Client 오류: `postinstall` 스크립트 확인
- TypeScript 오류: `tsconfig.json` 확인

**런타임 오류:**
- 데이터베이스 연결 실패: `DATABASE_URL` 확인
- 환경변수 누락: Vercel 대시보드에서 확인

**로컬과 다른 동작:**
- URL 문제: `NEXTAUTH_URL` 또는 `VERCEL_URL` 확인
- 이미지 로드 실패: `next.config.ts`의 `remotePatterns` 확인

### 📚 참고 자료

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)


## 배포 전 확인 사항

### ✅ 코드 준비
- [x] package.json에 빌드 스크립트 확인
- [x] next.config.ts 설정 확인
- [x] 환경변수 자동 감지 로직 추가 (`getAppUrl()`)
- [x] localhost 참조 제거
- [x] 데모 모드 에러 핸들링 추가
- [x] README에 배포 가이드 추가

### 📝 배포 전 작업

1. **Git 커밋 및 푸시**
   ```bash
   git add .
   git commit -m "feat: Vercel deployment setup"
   git push origin main
   ```

2. **환경변수 준비**
   - [ ] PostgreSQL 데이터베이스 생성 (Supabase/Neon/Vercel Postgres)
   - [ ] DATABASE_URL 복사
   - [ ] AUTH_SECRET 생성: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - [ ] OPENAI_API_KEY 준비

### 🚀 Vercel 배포 단계

1. **프로젝트 생성**
   - [ ] [Vercel Dashboard](https://vercel.com/dashboard) 접속
   - [ ] "Add New..." → "Project" 클릭
   - [ ] GitHub 저장소 선택 및 Import

2. **프로젝트 설정**
   - [ ] Framework Preset: Next.js (자동 감지)
   - [ ] Root Directory: `apps/web` (monorepo이므로 필수!)
   - [ ] Build Command: `npm run build` (기본값)
   - [ ] Output Directory: `.next` (기본값)
   - [ ] Install Command: `npm install` (기본값)

3. **환경변수 설정**
   Vercel 프로젝트 설정 → "Environment Variables" 탭에서 추가:
   
   **필수:**
   - [ ] `DATABASE_URL` = `postgresql://...`
   - [ ] `AUTH_SECRET` = `생성한-32바이트-문자열`
   - [ ] `OPENAI_API_KEY` = `sk-...`
   
   **선택:**
   - [ ] `NEXTAUTH_URL` = `https://your-project.vercel.app` (또는 VERCEL_URL 자동 감지)
   - [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (로그인 사용 시)
   - [ ] `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (이메일 사용 시)

4. **배포 실행**
   - [ ] "Deploy" 버튼 클릭
   - [ ] 빌드 로그 확인

### 📊 배포 후 작업

1. **데이터베이스 마이그레이션**
   ```bash
   # Vercel CLI 설치 (선택)
   npm i -g vercel
   
   # 환경변수 가져오기
   vercel env pull .env.local
   
   # 마이그레이션 실행
   cd apps/web
   npx prisma migrate deploy
   npx prisma db seed
   ```
   
   또는 Vercel 대시보드에서:
   - [ ] "Deployments" → 최신 배포 → "..." → "Redeploy"
   - [ ] 빌드 로그에서 Prisma 마이그레이션 확인

2. **기능 테스트**
   - [ ] 홈 페이지 접속 확인
   - [ ] 검색 기능 테스트
   - [ ] 제품 상세 페이지 확인
   - [ ] 품목 리스트 기능 테스트
   - [ ] 공유 링크 생성 테스트

3. **에러 모니터링**
   - [ ] Vercel 대시보드 → "Functions" 탭에서 에러 로그 확인
   - [ ] 브라우저 콘솔에서 클라이언트 에러 확인

### 🔧 트러블슈팅

**빌드 실패:**
- Prisma Client 오류: `postinstall` 스크립트 확인
- TypeScript 오류: `tsconfig.json` 확인

**런타임 오류:**
- 데이터베이스 연결 실패: `DATABASE_URL` 확인
- 환경변수 누락: Vercel 대시보드에서 확인

**로컬과 다른 동작:**
- URL 문제: `NEXTAUTH_URL` 또는 `VERCEL_URL` 확인
- 이미지 로드 실패: `next.config.ts`의 `remotePatterns` 확인

### 📚 참고 자료

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)


## 배포 전 확인 사항

### ✅ 코드 준비
- [x] package.json에 빌드 스크립트 확인
- [x] next.config.ts 설정 확인
- [x] 환경변수 자동 감지 로직 추가 (`getAppUrl()`)
- [x] localhost 참조 제거
- [x] 데모 모드 에러 핸들링 추가
- [x] README에 배포 가이드 추가

### 📝 배포 전 작업

1. **Git 커밋 및 푸시**
   ```bash
   git add .
   git commit -m "feat: Vercel deployment setup"
   git push origin main
   ```

2. **환경변수 준비**
   - [ ] PostgreSQL 데이터베이스 생성 (Supabase/Neon/Vercel Postgres)
   - [ ] DATABASE_URL 복사
   - [ ] AUTH_SECRET 생성: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - [ ] OPENAI_API_KEY 준비

### 🚀 Vercel 배포 단계

1. **프로젝트 생성**
   - [ ] [Vercel Dashboard](https://vercel.com/dashboard) 접속
   - [ ] "Add New..." → "Project" 클릭
   - [ ] GitHub 저장소 선택 및 Import

2. **프로젝트 설정**
   - [ ] Framework Preset: Next.js (자동 감지)
   - [ ] Root Directory: `apps/web` (monorepo이므로 필수!)
   - [ ] Build Command: `npm run build` (기본값)
   - [ ] Output Directory: `.next` (기본값)
   - [ ] Install Command: `npm install` (기본값)

3. **환경변수 설정**
   Vercel 프로젝트 설정 → "Environment Variables" 탭에서 추가:
   
   **필수:**
   - [ ] `DATABASE_URL` = `postgresql://...`
   - [ ] `AUTH_SECRET` = `생성한-32바이트-문자열`
   - [ ] `OPENAI_API_KEY` = `sk-...`
   
   **선택:**
   - [ ] `NEXTAUTH_URL` = `https://your-project.vercel.app` (또는 VERCEL_URL 자동 감지)
   - [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (로그인 사용 시)
   - [ ] `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (이메일 사용 시)

4. **배포 실행**
   - [ ] "Deploy" 버튼 클릭
   - [ ] 빌드 로그 확인

### 📊 배포 후 작업

1. **데이터베이스 마이그레이션**
   ```bash
   # Vercel CLI 설치 (선택)
   npm i -g vercel
   
   # 환경변수 가져오기
   vercel env pull .env.local
   
   # 마이그레이션 실행
   cd apps/web
   npx prisma migrate deploy
   npx prisma db seed
   ```
   
   또는 Vercel 대시보드에서:
   - [ ] "Deployments" → 최신 배포 → "..." → "Redeploy"
   - [ ] 빌드 로그에서 Prisma 마이그레이션 확인

2. **기능 테스트**
   - [ ] 홈 페이지 접속 확인
   - [ ] 검색 기능 테스트
   - [ ] 제품 상세 페이지 확인
   - [ ] 품목 리스트 기능 테스트
   - [ ] 공유 링크 생성 테스트

3. **에러 모니터링**
   - [ ] Vercel 대시보드 → "Functions" 탭에서 에러 로그 확인
   - [ ] 브라우저 콘솔에서 클라이언트 에러 확인

### 🔧 트러블슈팅

**빌드 실패:**
- Prisma Client 오류: `postinstall` 스크립트 확인
- TypeScript 오류: `tsconfig.json` 확인

**런타임 오류:**
- 데이터베이스 연결 실패: `DATABASE_URL` 확인
- 환경변수 누락: Vercel 대시보드에서 확인

**로컬과 다른 동작:**
- URL 문제: `NEXTAUTH_URL` 또는 `VERCEL_URL` 확인
- 이미지 로드 실패: `next.config.ts`의 `remotePatterns` 확인

### 📚 참고 자료

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)





