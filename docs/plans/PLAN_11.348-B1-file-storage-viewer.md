# Implementation Plan: §11.348-B-1 (+§11.357) — 파일 스토리지 + SDS/COA/안전 뷰어

- **Status:** 🗂️ Plan (Phase 0 진단 완료 — Large, 분할 착수 승인 대기)
- **Last Updated:** 2026-06-03
- **결정:** 호영님 2026-06-03 — "§11.357 안전관리(mock) + MSDS/COA 뷰어를 §11.348-B-1 파일 인프라로 **묶어서, 인프라 먼저**."
- **유형:** 신규 인프라(스토리지) + dead 서브시스템(SDS) 정상화 + mock→실데이터 wiring. canonical 보호.
- **Scope:** **Large** (B1-0 ~ B1-4 분할). 한 세션 surgical 불가.

## Phase 0 — 코드 정독 결과 (2026-06-03, 추측 없음)

### §11.357 안전관리 페이지 — 3건 판정
1. **데이터 소스 = mock 확정.** `/dashboard/safety/page.tsx` 의 화학물질 4건(Sulfuric Acid·Acetone·NaOH·Ethanol) = 하드코딩 `safetyItems` 배열("// Mock data") + `useState`. 재고(ProductInventory)·Product **미연동, fetch/useQuery 0**. 안전지수·"즉시조치/문서보완/정상" 판정은 `buildSafetyDecision()` 규칙엔진이 계산 → **규칙은 실재하나 입력이 mock.** TREND_DATA(7일)도 mock.
2. **MSDS = 페이지는 boolean 플래그만, 뷰어 없음.** `hasMsds: boolean` + `handleMsdsSave` = `setTimeout(800)+setItems` **fake save**(업로드/스토리지/파일 0). 페이지에 파일 열람 경로 없음.
3. **COA = 동일 패턴 확정.** `Product.coaUrl` 도 `msdsUrl` 과 같은 URL 필드만 존재, 뷰어/아카이브 UI 없음. → MSDS·COA 한 트랙 타당.

### 이미 존재하는 자산 (재사용)
- ✅ **canonical ontology**: `Product.msdsUrl / coaUrl / specSheetUrl / hazardCodes(Json) / pictograms(Json) / ppe(Json) / storageCondition / safetyNote`. → ontology 신규 결정 불필요.
- ✅ **스토리지 인프라**: `@supabase/supabase-js` + `lib/supabase.ts` + 작동 선례 `lib/orders/po-pdf-storage.ts`(PDF 업로드, Vercel Blob 폴백 테스트) + `lib/ocr/image-storage.ts`. 스토리지 패턴 검증됨.
- ✅ **안전 제품 API**: `GET /api/safety/products` — Product 를 hazardCodes/pictograms/storageCondition/missingSds 로 실조회(`$queryRaw @>` JSONB). 실데이터 wiring 대상.

### 핵심 결함 (Phase 0 발견)
- 🔴 **`SDSDocument` 모델이 어느 schema 에도, git 이력에도 없음.** 그런데 다음이 `db.sDSDocument` / `sdsDocuments` relation 을 참조 → **모델 없이 라우트만 scaffold된 dead 서브시스템(런타임 깨짐):**
  - `app/admin/safety/page.tsx` (SDS 목록 페이지)
  - `api/products/[id]/sds`, `api/safety/sds`, `api/safety/products`(include), `api/sds/[id]/{apply,extract,signed-url}`
- 🔴 `api/sds/[id]/signed-url` = Supabase signed-url **TODO**(임시 `/api/sds/[id]/download` 폴백 — 그 라우트도 부재) 또는 `product.msdsUrl` 폴백.
- ⇒ B-1 은 "복원"이 아니라 **SDSDocument 모델 신규 정의 + 스토리지 결선 + 뷰어 완성**.

## 핵심 원칙 (roadmap 계승)
- 파일 원본은 오브젝트 스토리지(Supabase/Blob), DB엔 메타 + 링크만 (PDF를 BLOB로 넣지 않음).
- 외부/추출 데이터(OCR extract)는 derived 제안, canonical 승격은 사람 승인.
- 같은 패턴을 MSDS·COA·SpecSheet 에 일괄 적용(URL 필드 + SDSDocument 형 메타).

## 분할 (phase별 SPEC + 승인)
- **B1-0 스토리지 인프라 확정 + `SDSDocument` 모델 (선행 핵심):**
  - `po-pdf-storage.ts` 패턴으로 업로드/서명URL 헬퍼 일반화(또는 재사용 범위 확정).
  - **`SDSDocument` 모델 신규**: productId(FK) + organizationId?(FK, 공용 null) + fileName + bucket + path + source(upload/ocr/vendor) + contentType + sizeBytes + extractedData(Json?) + createdAt. **DB migration → dry-run→보고→진행.**
  - dead 라우트 6개 + `admin/safety` 가 새 모델로 정상 컴파일/동작.
- **B1-1 업로드 + signed-url 완성:** signed-url TODO 제거(Supabase createSignedUrl) + 업로드 엔드포인트. 권한(조직 스코프) 보존.
- **B1-2 뷰어 UI:** products/[id] + 안전 페이지에서 MSDS/COA 클릭 → 파일 열람(서명URL). `products/[id]/page.tsx` 의 msdsUrl 표시가 선례.
- **B1-3 안전 페이지 실데이터 wiring (§11.357 본체):** mock `safetyItems` → `/api/safety/products`(+재고 연동). fake `handleMsdsSave` → 실제 업로드(B1-1). 규칙엔진(`buildSafetyDecision`)은 실데이터 입력으로 유지.
- **B1-4 COA 동형 적용:** coaUrl/SDSDocument(source=coa) 동일 뷰어·아카이브. LOT/품목별 조회(roadmap B-1 가치).

## 재사용 (신규 최소화)
- 스토리지: `po-pdf-storage.ts` / `image-storage.ts` / `lib/supabase.ts`.
- 조회: `api/safety/products`(이미 Product 안전필드 실조회).
- 규칙: `buildSafetyDecision()` 그대로(입력만 실데이터).
- 뷰어 선례: `products/[id]/page.tsx` msdsUrl.

## Risks
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| SDSDocument 모델 신규 = migration | High | High | B1-0 dry-run→보고→진행 |
| dead 라우트가 실호출 경로에 있어 라이브 장애 | Med | High | B1-0에서 admin/safety 진입 경로·런타임 호출 여부 확정(빌드 통과 여부 포함) |
| Supabase 스토리지 prod 미설정 | Med | Med | env(SUPABASE_*) ops 확인, Blob 폴백(po-pdf 선례) |
| 안전 페이지 wiring 시 mock UX 회귀 | Med | Med | 규칙엔진 보존 + 상태별 UI(loading/empty), sentinel |
| 한 세션 과욕 | High | Med | B1-0~4 phase별 착수·승인 |

## Open Questions (착수 전)
- [ ] dead SDS 라우트/admin-safety 페이지가 **현재 빌드를 깨고 있는가** vs 런타임만 깨지는가? (B1-0 첫 확인 — `db.sDSDocument` 타입 부재인데 배포됨 = `db` 느슨 타입 or 미사용 경로)
- [ ] 스토리지 = Supabase 단일 vs Blob 폴백 유지(po-pdf 선례)?
- [ ] SDSDocument 와 `Product.msdsUrl`(단일 URL) 관계 — msdsUrl = 최신 1건 캐시 vs SDSDocument[] 가 정본?

## 권장 착수 순서
B1-0(모델+인프라, migration dry-run) → B1-1(업로드/서명URL) → B1-2(뷰어) → B1-3(안전 실데이터) → B1-4(COA 동형). B1-0 선행(모델·스토리지 없이 나머지 불가).

---
## 부록 — B1-0 구현 완료 (Claude, 2026-06-03, push + migration 적용 대기)
- ✅ **Open Q1 해결**: dead SDS 라우트가 빌드를 깨는가? → **아니오.** `lib/db.ts` `db:any` + Proxy stub → SDSDocument 부재여도 빌드 통과. 단 실 client 호출 시 런타임 500(orphaned). B1-0 가 정상화.
- ✅ **SDSDocument 모델 추가**: productId(FK)+organizationId?(FK)+fileName+bucket+path+source+contentType?+sizeBytes?+extractionStatus?+extractionResult(Json)+timestamps. Product/Organization 백릴레이션. 라우트 필드 접근 전수 반영.
- ✅ **migration 순수 추가형**: `20260603130000_add_sds_document` — CREATE TABLE + INDEX3 + FK2, 기존 테이블 무변경. `prisma validate` 통과.
- ✅ sentinel `sds-document-model-348b1` 3/3 green.
- ⚠️ **적용 게이트**: 호영님 `prisma migrate dev` + `generate` 후 활성. 적용 즉시 orphaned 라우트 런타임 500 위험 해소.
- **다음(적용 후)**: B1-1 signed-url 완성(Supabase createSignedUrl TODO) + 업로드 → B1-2 뷰어 → B1-3 안전 실데이터(§11.357) → B1-4 COA.

### Open Q 갱신
- [x] dead 라우트 빌드/런타임 — **빌드 비차단, 런타임 500**(db:any+stub). B1-0 적용으로 해소.
- [ ] 스토리지 Supabase 단일 vs Blob 폴백 — B1-1 에서 `po-pdf-storage.ts` 패턴 확인 후 결정.
- [ ] SDSDocument vs Product.msdsUrl 관계 — B1-1/B1-2: msdsUrl=레거시 단일 URL, SDSDocument[]=정본(뷰어는 SDSDocument 우선, msdsUrl 폴백).

## Notes
- §11.357 은 독립 스펙이 아니라 **B-1의 B1-3 phase로 흡수**(파일 인프라 위에).
- A-3(입고안 모델)과 무관·독립 — 병행 가능하나 둘 다 migration이라 적용은 순차 권장.
