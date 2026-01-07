# Supabase SQL Editor를 통한 데이터베이스 설정 가이드

DIRECT_URL 연결이 실패하는 경우, Supabase SQL Editor를 사용하여 데이터베이스 스키마를 직접 생성할 수 있습니다.

## 실행 방법

### 1. Supabase 대시보드 접속
1. Supabase 프로젝트 대시보드로 이동
2. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 2. pgvector 확장 설치 (필수)
먼저 벡터 검색을 위한 확장을 설치합니다:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Run** 버튼을 클릭하여 실행합니다.

### 3. 전체 스키마 생성
`setup-database-full.sql` 파일의 전체 내용을 복사하여 SQL Editor에 붙여넣고 **Run** 버튼을 클릭합니다.

또는 아래 SQL을 직접 실행:

```sql
-- pgvector 확장 (위에서 실행했다면 생략)
CREATE EXTENSION IF NOT EXISTS vector;

-- 이제 setup-database-full.sql 파일의 전체 내용을 복사해서 실행하세요
```

## 파일 위치
- 전체 SQL: `apps/web/setup-database-full.sql`

## 실행 후 확인

SQL 실행이 완료되면 다음 명령어로 확인할 수 있습니다:

```bash
cd apps/web
pnpm db:test
```

이제 테이블 목록이 표시되어야 합니다.

## 주의사항

- SQL을 실행하기 전에 데이터베이스가 비어있는지 확인하세요
- 이미 테이블이 있는 경우 오류가 발생할 수 있습니다
- 오류가 발생하면 해당 부분만 수정하여 다시 실행하세요

## 다음 단계

스키마 생성이 완료되면:
1. Prisma Client 재생성: `pnpm db:generate`
2. 연결 테스트: `pnpm db:test`
3. 개발 서버 실행: `pnpm dev`














