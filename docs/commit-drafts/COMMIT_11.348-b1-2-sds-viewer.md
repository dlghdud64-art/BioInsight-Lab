# COMMIT — §11.348-B-1 B1-2: SDS 문서 뷰어 섹션 (업로드/열람)

```
feat(safety) §11.348-B-1-2 #sds-viewer — 제품 상세 안전 섹션에 SDS 문서 목록/업로드/열람(서명URL) same-canvas 섹션 추가
```

## 무엇 (B1-0/B1-1 위 사용자 surface)
- `products/[id]` "안전·규제 정보" 섹션에 SDS 문서 UI 추가: 목록(GET) + 업로드(POST multipart, csrfFetch) + 열람(POST signed-url → window.open). 기존 `Product.msdsUrl` 링크는 그대로(레거시), 그 아래 SDSDocument[] 정본 노출.

## 신규/수정
- 신규 `components/safety/sds-documents-section.tsx`: 자체 fetch/state. 업로드 시 스토리지 미설정(503 `STORAGE_NOT_CONFIGURED`) → 친화 안내(silent 성공 금지). 열람은 서명URL 없으면 toast 에러. 0건 시 컴팩트 empty.
- `products/[id]/page.tsx`: import + MSDS 블록 직후 `<SdsDocumentsSection productId={product.id} />` 마운트(same-canvas, 신규 페이지 X).

## 제약 준수
- page-per-feature 금지 — 기존 안전 섹션에 통합.
- canonical 보호 — 업로드/열람만, 안전필드(Product) 승격은 사람 승인(apply, B1-3).
- 정본 우선순위 = SDSDocument(서명URL) + 레거시 msdsUrl 병존.

## migration
- **없음.** (B1-0 적용분 + B1-1 라우트 위 UI.)

## 검증 (vitest)
- `sds-viewer-section-348b1-2.test.ts` → **2/2** (컴포넌트 목록/업로드/열람 + 마운트).
- ⚠️ 실제 업로드·열람은 SUPABASE_* env 필요(ops). 없으면 graceful(업로드 안내/열람 toast).

## Out of Scope (B-1 다음)
- B1-3: 안전 페이지 mock→실데이터(§11.357) + SDS 섹션 재사용. B1-4: COA 동형(source=coa / coaUrl).

## Rollback
- 신규 컴포넌트 + sentinel 삭제, page import/mount revert. 독립.
```
footer 없음
```
