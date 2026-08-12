# 데이터베이스 설정 가이드

## 1. pgAdmin에서 데이터베이스 생성

1. **pgAdmin 실행**
   - Windows 시작 메뉴에서 "pgAdmin 4" 검색 후 실행

2. **서버 연결**
   - 왼쪽 패널에서 PostgreSQL 서버를 확장
   - 설치 시 설정한 비밀번호 입력

3. **데이터베이스 생성**
   - "Databases" 우클릭 → "Create" → "Database"
   - Database name: `ai_biocompare` 입력
   - "Save" 클릭

## 2. .env 파일 확인

`apps/web/.env` 파일을 열고 다음 형식으로 설정되어 있는지 확인:

```env
DATABASE_URL="postgresql://postgres:비밀번호@localhost:5432/ai_biocompare?schema=public"
```

**중요 사항:**
- `postgres`는 기본 사용자명 (변경했다면 실제 사용자명 사용)
- `비밀번호`는 PostgreSQL 설치 시 설정한 비밀번호
- 포트는 기본적으로 `5432` (변경했다면 실제 포트 사용)
- 비밀번호에 특수문자(`@`, `#`, `%` 등)가 있으면 URL 인코딩 필요:
  - `@` → `%40`
  - `#` → `%23`
  - `%` → `%25`
  - `&` → `%26`

**예시:**
```env
# 비밀번호가 "mypass@123"인 경우
DATABASE_URL="postgresql://postgres:mypass%40123@localhost:5432/ai_biocompare?schema=public"
```

## 3. 연결 테스트

데이터베이스 생성 후 다음 명령어로 마이그레이션 실행:

```bash
cd apps/web
npm run db:migrate
```

## 4. 문제 해결

### 권한 오류가 계속 발생하는 경우

1. **PostgreSQL 서비스 확인**
   - Windows 서비스 관리자에서 "postgresql-x64-XX" 서비스가 실행 중인지 확인

2. **사용자 권한 확인**
   - pgAdmin에서 해당 데이터베이스의 권한 설정 확인

3. **포트 확인**
   - PostgreSQL이 다른 포트를 사용하는 경우 .env 파일의 포트 번호 수정

4. **방화벽 확인**
   - Windows 방화벽이 PostgreSQL 연결을 차단하지 않는지 확인

