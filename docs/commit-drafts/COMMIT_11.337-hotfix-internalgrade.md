fix(schema): §11.337-hotfix P0 #internalgrade-revert — 검색 다운 복구 (스키마-DB 불일치) (호영님 P0, 2026-06-01)

호영님 P0 장애 — 검색 전체 0건. Prisma 에러:
"The column `Product.internalGrade` does not exist in the current database."

원인 (가설 C 확정 — 내 §11.341 순서 실수):
- §11.341 1단계에서 schema.prisma 에 internalGrade/gradeSource 추가 + migration 작성.
- 그러나 migration 은 operator-shell 수동(Vercel prebuild NO-OP)이라 prod DB 미적용 상태에서
  schema 변경분이 먼저 배포됨.
- products/search findMany 가 `include` 만 쓰고 `select` 없음 → Product 전체 스칼라 컬럼 자동 SELECT
  → schema 의 internalGrade/gradeSource 까지 SELECT 시도 → prod DB 에 없는 컬럼 → 쿼리 실패 → 검색 0건.
- 코드엔 internalGrade 명시 참조 0(가설 B 아님). 순수 스키마-DB drift.

핵심 교훈: "컬럼 추가" 는 migration(prod DB) 먼저 → schema/코드 나중 순서여야 함.
schema 가 앞서면 자동 select 가 없는 컬럼을 읽어 전체 쿼리 다운.

Fix (file 별):

- prisma/schema.prisma:
  · internalGrade/gradeSource 활성 정의 제거(주석 처리). grade 주석 원복.
  · 재추가 순서 주석 명시: migrate deploy(prod 컬럼) → schema 재추가 → 배포.

- scripts/import-catno-master.ts:
  · internalGrade: p.grade → grade: p.grade 원복(컬럼 존재 보장). 분리는 §11.341 재개 시.

- prisma/migrations/20260601120000_add_product_internal_grade_source/:
  · 호영님 env 에서 폴더 삭제 필요(sandbox 권한 불가). §11.341 재개 시 재생성.
  · (남겨둬도 prebuild NO-OP 라 자동 적용 안 됨 → 장애 무관, 단 migrate dev drift 경고 방지 위해 제거 권장.)

canonical truth / 제약:
- Product.grade(기존 컬럼) 그대로 — 데이터 보존(import 된 A~E 포함).
- 스키마 = prod DB 일치 복구. 추가 컬럼 0 → findMany 자동 select 안전.
- §11.341 필드 분리는 "migration 먼저" 순서로 별도 재개.

production effect:
- 검색 findMany 가 존재하는 컬럼만 select → 검색 정상 복구(P0 해소).
- §11.337 Part A(매칭)/B(배지)/§11.339(우측 카트) 영향 0(별개).

검증 (sandbox):
- 활성 internalGrade/gradeSource 참조 0(src/schema/scripts grep, 주석만).
- prisma validate 문법 정상(5.22.0). schema Product model 보존.
- 빌드/배포 = 호영님 env.

E2E (호영님 env — 배포 후 필수):
- "P" 검색 → 결과 정상 반환(0건 아님) — 장애 해소 확인.
- §11.337 매칭 정밀도 + 배지 + §11.339 우측 카트 동작 재확인.

Rollback path: git revert <SHA>
- (이 커밋 자체가 §11.341 schema 변경의 revert — 추가 rollback 불요.)

⚠️ §11.341 재개 절차(다음, 순서 엄수):
1. prisma migrate(internalGrade/gradeSource 컬럼) 파일 재생성 → 호영님 operator-shell `prisma migrate deploy` 로 prod DB 먼저 적용.
2. migrate deploy 성공 확인 후 → schema.prisma 활성 정의 재추가 + import internalGrade 전환.
3. 배포. (schema 가 prod DB 보다 앞서지 않게.)

## Push (P0 — 즉시)
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
# migration 폴더 삭제(sandbox 권한 불가했음)
Remove-Item -Recurse apps/web/prisma/migrations/20260601120000_add_product_internal_grade_source -ErrorAction SilentlyContinue
cd apps\web; npx prisma generate; npx next build   # 빌드 성공 확인
cd ..\..
git add apps/web/prisma/schema.prisma `
  apps/web/scripts/import-catno-master.ts `
  docs/commit-drafts/COMMIT_11.337-hotfix-internalgrade.md
git rm -r --cached apps/web/prisma/migrations/20260601120000_add_product_internal_grade_source 2>$null
git commit -F docs/commit-drafts/COMMIT_11.337-hotfix-internalgrade.md
git push origin main
```

## Next
- 배포 후 "P" 검색 정상 복구 확인 → §11.341 은 "migration 먼저" 순서로 재진입.
