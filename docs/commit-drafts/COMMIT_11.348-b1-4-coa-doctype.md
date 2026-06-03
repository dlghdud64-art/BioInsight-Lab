# COMMIT — §11.348-B-1 B1-4: COA 동형 (docType 판별자) — B-1 완결

```
feat(safety) §11.348-B-1-4 #coa-doctype — SDSDocument docType(sds/coa) 추가로 COA 아카이브 동형 재사용 (migration + 라우트/컴포넌트 docType-aware + 제품 COA 섹션)
```

## 무엇 (B-1 마지막 — COA 동형)
- SDS 인프라(모델/스토리지/서명URL/업로드/뷰어)를 **COA 에 그대로 재사용**. `SDSDocument.docType`(sds/coa) 판별자 1개로 분리 — 신규 모델/중복 0.

## Fix (file별)
- `schema.prisma`: `SDSDocument.docType String @default("sds")` + `@@index([docType])`. **기존 행 backward-compat = "sds".**
- migration `20260603140000_add_sds_doctype`: `ALTER TABLE ADD COLUMN docType DEFAULT 'sds'` + index. **DROP 0, 기존 데이터 무영향.**
- `api/products/[id]/sds`: GET `?docType` 필터 + POST `docType`(coa/sds 가드) 저장.
- `components/safety/sds-documents-section.tsx`: `docType`/`title` prop → `?docType` 조회 + 업로드 append + 라벨(SDS/COA(시험성적서)) + testid 분리.
- `products/[id]/page.tsx`: SDS 섹션 + **COA 섹션**(`docType="coa"`) 2개 마운트.

## 설계
- COA 별도 모델 대신 docType 판별자 = 인프라 100% 재사용("동형"). 정본 = SDSDocument(docType) + 레거시 Product.coaUrl 병존(향후 폴백).

## migration (호영님 적용 게이트)
- `prisma migrate dev` + `generate` 필요. ADD COLUMN DEFAULT = 즉시·무손실.

## 검증 (vitest)
- `coa-doctype-348b1-4.test.ts` → **5/5** (schema·migration / 라우트 docType / 컴포넌트·페이지). B1-0/B1-1/B1-2 회귀 동반 green(B1-2 sentinel 마운트 단언 docType 허용으로 갱신).

## Out of Scope (별도)
- B1-3b: 안전 mutation 영속화. COA 교차검증(§11.348-B-2, 품목 규격 ontology 선행). §11.348-FALLBACK(OCR).

## Rollback
- migration + schema docType + 라우트/컴포넌트/페이지 패치 + sentinel revert. ADD COLUMN 이라 역마이그레이션 단순(DROP COLUMN).
```
footer 없음
```
