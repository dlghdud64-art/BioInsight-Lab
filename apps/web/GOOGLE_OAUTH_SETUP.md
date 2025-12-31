# Google OAuth 설정 가이드

이 가이드는 Google 로그인을 활성화하기 위한 설정 방법을 안내합니다.

## 1. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성

### 1.1 Google Cloud Console 접속
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 또는 새 프로젝트 생성

### 1.2 OAuth 동의 화면 구성
1. 좌측 메뉴에서 **API 및 서비스** > **OAuth 동의 화면** 선택
2. **외부(External)** 선택 후 **만들기** 클릭
3. 앱 정보 입력:
   - **앱 이름**: BioInsight Lab (또는 원하는 이름)
   - **사용자 지원 이메일**: 본인 이메일
   - **개발자 연락처 정보**: 본인 이메일
4. **저장 후 계속** 클릭
5. 범위(Scopes) 단계: 그대로 **저장 후 계속**
6. 테스트 사용자 단계: 본인 이메일 추가 후 **저장 후 계속**

### 1.3 OAuth 2.0 클라이언트 ID 만들기
1. 좌측 메뉴에서 **API 및 서비스** > **사용자 인증 정보** 선택
2. 상단의 **+ 사용자 인증 정보 만들기** > **OAuth 2.0 클라이언트 ID** 선택
3. 애플리케이션 유형: **웹 애플리케이션** 선택
4. 이름: `BioInsight Lab - Web` (또는 원하는 이름)
5. **승인된 자바스크립트 원본** 추가:
   ```
   http://localhost:3000
   ```
6. **승인된 리디렉션 URI** 추가:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. **만들기** 클릭
8. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀번호** 복사 (나중에 사용)

## 2. 환경 변수 설정

### 2.1 .env.local 파일 생성
`apps/web/.env.local` 파일을 생성하고 다음 내용을 추가합니다:

```bash
# NextAuth
AUTH_SECRET="your-random-secret-here"  # 아무 랜덤 문자열 (예: openssl rand -base64 32)
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id-here"
GOOGLE_CLIENT_SECRET="your-google-client-secret-here"

# Database (이미 설정되어 있으면 그대로 유지)
DATABASE_URL="your-database-url"
DIRECT_URL="your-direct-url"
```

### 2.2 AUTH_SECRET 생성
터미널에서 다음 명령어를 실행하여 랜덤 시크릿 생성:

**PowerShell (Windows)**:
```powershell
# 방법 1: .NET 사용
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# 방법 2: Node.js 사용
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Bash (Mac/Linux)**:
```bash
openssl rand -base64 32
```

생성된 값을 `AUTH_SECRET`에 입력합니다.

### 2.3 Google OAuth 정보 입력
1.3 단계에서 복사한 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 각각 `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`에 입력합니다.

## 3. 개발 서버 재시작

```powershell
cd apps/web
pnpm dev
```

## 4. 로그인 테스트

1. 브라우저에서 http://localhost:3000/test/quote 접속
2. "로그인" 버튼 클릭
3. Google 계정으로 로그인
4. 저장 버튼이 활성화되고 서버에 저장 가능

## 문제 해결

### 400 오류: invalid_request
- `.env.local` 파일이 제대로 생성되었는지 확인
- `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`가 올바른지 확인
- 개발 서버를 재시작했는지 확인

### 리디렉션 URI 불일치
- Google Cloud Console에서 승인된 리디렉션 URI가 정확히 다음과 같은지 확인:
  ```
  http://localhost:3000/api/auth/callback/google
  ```

### 앱이 차단됨
- OAuth 동의 화면에서 본인 이메일을 테스트 사용자로 추가했는지 확인

## 현재 상태 (로그인 없이 사용)

Google OAuth 설정 없이도 `/test/quote` 페이지는 사용 가능합니다:
- ✅ 품목 추가/수정/삭제
- ✅ 브라우저 로컬 스토리지에 저장
- ✅ TSV/CSV 내보내기
- ❌ 서버에 저장 (로그인 필요)
- ❌ URL로 공유 (로그인 필요)
- ❌ 새로고침 시 서버에서 복원 (로그인 필요)

로그인하면 서버에 저장되어 다른 기기에서도 접근할 수 있습니다.











