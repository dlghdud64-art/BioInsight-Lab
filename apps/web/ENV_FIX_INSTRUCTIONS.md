# .env 파일 수정 가이드

## 현재 문제
DATABASE_URL이 Prisma Cloud 형식으로 설정되어 있습니다. 로컬 PostgreSQL을 사용하려면 변경이 필요합니다.

## 수정 방법

`apps/web/.env` 파일을 열고 다음 줄을 찾아서:

**현재 (잘못된 형식):**
```env
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=..."
```

**다음으로 변경:**
```env
DATABASE_URL="postgresql://postgres:실제_비밀번호@localhost:5432/ai_biocompare?schema=public"
```

## 비밀번호 설정 방법

1. **PostgreSQL 설치 시 설정한 비밀번호 사용**
   - Stack Builder 설치 시 설정한 postgres 사용자 비밀번호

2. **비밀번호를 모르는 경우**
   - pgAdmin에서 비밀번호 재설정
   - 또는 PostgreSQL 설정 파일에서 비밀번호 확인

3. **비밀번호에 특수문자가 있는 경우 URL 인코딩**
   - `@` → `%40`
   - `#` → `%23`
   - `%` → `%25`
   - `&` → `%26`

## 예시

```env
# 비밀번호가 "mypassword"인 경우
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/ai_biocompare?schema=public"

# 비밀번호가 "pass@123"인 경우
DATABASE_URL="postgresql://postgres:pass%40123@localhost:5432/ai_biocompare?schema=public"
```

## 포트 확인

PostgreSQL이 기본 포트(5432)가 아닌 다른 포트를 사용하는 경우:
- pgAdmin에서 서버 속성 확인
- 또는 Windows 서비스에서 PostgreSQL 설정 확인

## 수정 후

1. .env 파일 저장
2. 다음 명령어 실행:
   ```bash
   cd apps/web
   npm run db:migrate
   ```

