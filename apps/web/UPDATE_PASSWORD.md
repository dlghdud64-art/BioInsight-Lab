# PostgreSQL 비밀번호 업데이트 필요

## 현재 상태
- ✅ 데이터베이스 연결 형식은 올바릅니다
- ❌ 인증 실패: 비밀번호가 일치하지 않습니다

## 해결 방법

### 1. .env.local 파일 수정

`apps/web/.env.local` 파일을 열고 다음 줄을 찾습니다:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_biocompare?schema=public"
```

**비밀번호 부분을 실제 PostgreSQL 비밀번호로 변경하세요:**

```
DATABASE_URL="postgresql://postgres:실제_비밀번호@localhost:5432/ai_biocompare?schema=public"
```

### 2. PostgreSQL 비밀번호 확인 방법

**방법 A: pgAdmin 사용**
1. pgAdmin 실행
2. 서버 연결 시 사용한 비밀번호 확인

**방법 B: PostgreSQL 설치 시 설정한 비밀번호**
- Stack Builder 설치 시 설정한 postgres 사용자 비밀번호

**방법 C: 비밀번호 재설정**
1. pgAdmin에서 서버 우클릭 → "Properties"
2. "Connection" 탭에서 비밀번호 확인 또는 변경

### 3. 비밀번호에 특수문자가 있는 경우

URL 인코딩이 필요합니다:
- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- `&` → `%26`

**예시:**
- 비밀번호가 `mypass@123`인 경우:
  ```
  DATABASE_URL="postgresql://postgres:mypass%40123@localhost:5432/ai_biocompare?schema=public"
  ```

### 4. 수정 후 마이그레이션 실행

```bash
cd apps/web
npm run db:migrate
```

