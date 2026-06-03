# COMMIT — §11.348-B-1 B1-0: SDSDocument 모델 정규화 (migration)

```
feat(schema) §11.348-B-1-0 #sds-document-model — orphaned db.sDSDocument 참조를 정규화하는 SDSDocument 모델 추가 (파일 스토리지 메타, 순수 추가형 migration)
```

## 무엇 (B-1 토대 — orphaned 서브시스템 정상화)
- 기존 라우트(`api/sds/[id]/{signed-url,extract,apply}`, `api/products/[id]/sds`, `api/safety/sds`, `api/safety/products` include, `admin/safety`)가 `db.sDSDocument` 를 참조하나 **schema·git 이력 어디에도 모델 없음** → 실 Prisma Client 에서 `undefined.findMany` = 런타임 500(orphaned). B1-0 가 모델을 정의해 정상화.

## Phase 0 진단 (코드)
- `lib/db.ts` `db: any` + Proxy stub → SDSDocument 부재여도 **빌드 안 깨짐**(`ignoreBuildErrors:false` 무관, any 접근 합법). 단 실 client 호출 시 런타임 깨짐.
- 라우트 필드 접근 전수: productId(+product), organizationId(+organization), fileName, bucket, path, source, extractionStatus(queued/processing/done/failed), extractionResult(Json), createdAt.

## 모델
- `SDSDocument`: id + productId(FK Product Cascade) + organizationId?(FK SetNull, 공용=null) + fileName + bucket + path + source(@default "upload") + contentType? + sizeBytes? + extractionStatus? + extractionResult(Json?) + createdAt/updatedAt.
- 백릴레이션: `Product.sdsDocuments[]`, `Organization.sdsDocuments[]`.
- 원본 파일은 오브젝트 스토리지(bucket/path), DB엔 메타+링크만(BLOB 금지). extractionResult = 검증 전 derived(canonical 안전필드 Product 승격은 사람 승인 = api/sds/[id]/apply).

## migration (순수 추가형)
- `prisma/migrations/20260603130000_add_sds_document/migration.sql` — CREATE TABLE SDSDocument + INDEX 3 + FK 2. **기존 테이블 ALTER/DROP 0.** offline diff 생성, sandbox DB 미접속.

## 검증 (vitest)
- `sds-document-model-348b1.test.ts` → **3/3** (모델/백릴레이션·FK/migration 순수추가).

## ⚠️ 적용 게이트 (호영님 환경)
- DB migration 포함. push 후 `npx prisma migrate dev` + `npx prisma generate` 적용 시 실 DB 변경 + 클라이언트에 SDSDocument 생성.
- 순수 추가형 = 기존 데이터 무영향. 적용 즉시 orphaned 라우트의 런타임 500 위험 해소(findMany → []).
- production DB 변경이므로 dry-run SQL 확인 → "진행" 후 적용.

## Out of Scope (B-1 다음 phase — migration 적용 후)
- B1-1: signed-url 완성(Supabase createSignedUrl, 현재 TODO) + 업로드 엔드포인트.
- B1-2: MSDS/COA 뷰어 UI. B1-3: 안전 페이지 mock→실데이터(§11.357). B1-4: COA 동형.

## Rollback
- migration 디렉토리 + schema 모델/백릴레이션 2 + sentinel revert. 순수 추가형이라 독립.
```
footer 없음
```
