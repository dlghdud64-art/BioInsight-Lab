# 데이터베이스 연결 확인 방법

## 방법 1: 브라우저 개발자 도구 확인

### 1. 브라우저 개발자 도구 열기
- **Chrome/Edge**: `F12` 또는 `Ctrl + Shift + I`
- **Firefox**: `F12` 또는 `Ctrl + Shift + I`

### 2. Console 탭 확인
- 데이터베이스 연결 오류가 있는지 확인
- Prisma 관련 오류 메시지 확인
- 일반적인 오류 예시:
  - `Prisma Client not found`
  - `Can't reach database server`
  - `Circuit breaker open`
  - `Authentication failed`

### 3. Network 탭 확인
- API 요청이 정상적으로 전송되는지 확인
- 데이터베이스 관련 API 호출 확인
- 응답 상태 코드 확인 (200 = 성공, 500 = 서버 오류)

## 방법 2: API 엔드포인트 직접 테스트

### 간단한 API 테스트

브라우저 주소창이나 새 탭에서 다음 URL들을 테스트:

#### 1. 제품 브랜드 목록 (데이터베이스 쿼리 필요)
```
http://localhost:3000/api/products/brands
```

**예상 결과:**
- 성공: `[]` (빈 배열) 또는 브랜드 목록
- 실패: `{"error": "Failed to fetch brands"}` 또는 500 오류

#### 2. 제품 검색 (데이터베이스 쿼리 필요)
```
http://localhost:3000/api/products/search?q=test
```

**예상 결과:**
- 성공: 제품 목록 (빈 배열일 수도 있음)
- 실패: 오류 메시지

#### 3. 설정 확인 (데이터베이스 연결 불필요)
```
http://localhost:3000/api/config
```

**예상 결과:**
- 성공: 설정 정보
- 실패: 오류 메시지

## 방법 3: 터미널에서 API 테스트

PowerShell에서 다음 명령어 실행:

```powershell
# 제품 브랜드 목록 테스트
Invoke-WebRequest -Uri "http://localhost:3000/api/products/brands" -Method GET | Select-Object StatusCode, Content

# 제품 검색 테스트
Invoke-WebRequest -Uri "http://localhost:3000/api/products/search?q=test" -Method GET | Select-Object StatusCode, Content
```

## 방법 4: 애플리케이션 기능 테스트

### 홈페이지에서 테스트
1. 검색 기능 사용
2. 제품 목록 표시 확인
3. 데이터베이스 관련 기능 테스트

### 대시보드 접속 (로그인 필요할 수 있음)
```
http://localhost:3000/dashboard
```

## 방법 5: 서버 로그 확인

개발 서버를 실행한 터미널에서:
- 데이터베이스 연결 관련 로그 확인
- Prisma 쿼리 로그 확인
- 오류 메시지 확인

## 예상 결과

### ✅ 정상 작동하는 경우
- API 요청이 200 상태 코드 반환
- 빈 배열 `[]` 반환 (데이터가 없어도 정상)
- 콘솔에 데이터베이스 연결 오류 없음
- 서버 로그에 Prisma 쿼리 로그 표시

### ❌ 문제가 있는 경우
- API 요청이 500 상태 코드 반환
- `{"error": "..."}` 오류 메시지 반환
- 콘솔에 데이터베이스 연결 오류 표시
- 서버 로그에 Circuit breaker 오류 표시

## 빠른 확인 명령어

터미널에서 실행:

```bash
# API 테스트 스크립트
curl http://localhost:3000/api/products/brands
```

또는 PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/products/brands" -Method GET
```














