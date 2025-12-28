# 데이터베이스 연결 확인 방법

## ✅ 확인된 사항

- ✅ 개발 서버: 실행 중 (`http://localhost:3000`)
- ✅ Config API: 정상 작동 (데이터베이스 불필요)
- ❌ Brands API: 500 오류 (데이터베이스 연결 문제 가능)

## 🔍 확인 방법

### 방법 1: 브라우저 개발자 도구 (가장 쉬움)

1. **브라우저에서 `http://localhost:3000` 접속**
2. **F12 키 누르기** (개발자 도구 열기)
3. **Console 탭 확인**
   - 데이터베이스 연결 오류 메시지 확인
   - Prisma 관련 오류 확인
4. **Network 탭 확인**
   - API 요청 상태 확인
   - 오류 응답 확인

### 방법 2: API 엔드포인트 직접 테스트

브라우저 주소창에 입력:

#### ✅ 정상 작동 (데이터베이스 불필요)
```
http://localhost:3000/api/config
```
**예상 결과:** `{"pdfMode": "server-upload", "pdfUploadEnabled": true}`

#### ❌ 데이터베이스 연결 필요 (오류 가능)
```
http://localhost:3000/api/products/brands
```
**예상 결과:**
- 성공: `[]` (빈 배열) 또는 브랜드 목록
- 실패: `{"error": "Failed to fetch brands"}` 또는 500 오류

### 방법 3: 터미널에서 테스트

PowerShell에서:

```powershell
# Config API (데이터베이스 불필요)
Invoke-RestMethod -Uri "http://localhost:3000/api/config"

# Brands API (데이터베이스 필요)
Invoke-RestMethod -Uri "http://localhost:3000/api/products/brands"
```

### 방법 4: 서버 로그 확인

개발 서버를 실행한 터미널에서:
- 데이터베이스 연결 관련 로그 확인
- Prisma 쿼리 로그 확인
- 오류 메시지 확인

**찾아야 할 로그:**
- `Prisma Client not available`
- `Circuit breaker open`
- `Can't reach database server`
- `Authentication failed`

## 📊 예상 결과

### ✅ 정상 작동하는 경우
- API 요청이 200 상태 코드 반환
- 빈 배열 `[]` 반환 (데이터가 없어도 정상)
- 콘솔에 데이터베이스 연결 오류 없음
- 서버 로그에 Prisma 쿼리 로그 표시

### ❌ 문제가 있는 경우
- API 요청이 500 상태 코드 반환
- `{"error": "Failed to fetch brands"}` 오류 메시지
- 콘솔에 데이터베이스 연결 오류 표시
- 서버 로그에 Circuit breaker 오류 표시

## 🛠️ 문제 해결

### Brands API가 500 오류를 반환하는 경우

1. **서버 로그 확인**
   - 개발 서버 터미널에서 오류 메시지 확인
   - Prisma 관련 오류 확인

2. **데이터베이스 연결 확인**
   - `.env.local` 파일의 `DATABASE_URL` 확인
   - Supabase 프로젝트 상태 확인

3. **임시 해결책**
   - 데이터베이스 연결이 실패해도 애플리케이션이 작동하도록 설계됨
   - 빈 배열을 반환하거나 더미 데이터 사용

## 💡 빠른 확인

브라우저에서:
1. `http://localhost:3000` 접속
2. F12 → Console 탭
3. 오류 메시지 확인

또는 브라우저 주소창에:
```
http://localhost:3000/api/products/brands
```

결과를 확인하고 알려주세요!










