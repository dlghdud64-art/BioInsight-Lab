# PLAN — 소싱 제품 surface 정리 (§1-2④⑤⑥⑦)

> **§1-2⑤ 확장 스코프 큐잉 (2026-06-11, 호영님 라이브 진단 — P1 scan intent 후 진입):**
> /products/[id] 상세가 "고도화 안 된 느낌" = UI 가 아니라 데이터·추천 레이어 공백.
> 진단 5건: ① Specifications = identity 3필드 tautology (실 spec 0 — catalog backfill
> 별도 foundational 트랙) ② 연관 추천 fake — "유사한 제품입니다" canned 근거 + cross-category
> noise (시약 상세에 기구 추천) ③ 상세 진입 시 소싱 상태(비교 포함/견적 미포함) 하강 —
> quick-view rail 상태를 full page 가 승계 못 함 (§11.381c canonical 일원화와 역행)
> ④ 표시명 PBS-3 ↔ Cat.No PBS-1A 불일치 + sparse price = seed 데이터 smell
> ⑤ 안전정보 편집·SDS/COA 업로드 버튼 buyer 노출 여부 점검 (vendor/admin 전용이어야).
> **batch 구성(확정 시)**: ②추천 cross-category 필터+근거 실데이터화 + ③rail 상태 full view
> 승계 + ①라벨 정직화 = 1 batch. catalog spec backfill 은 분리 트랙.

- **Status:** 🔄 sandbox GREEN (P1~P3 구현 완료) / 클로드코드 vitest 재확정 + push 대기
- **Started:** 2026-06-10
- **Last Updated:** 2026-06-10
- **트랙 분리:** §11.37x(스캔 reconcile)와 **별개 트랙**. (b) push(`54b77310`)로 baseline clean.

> ⛔ phase quality gate 통과 후에만 다음 phase. TDD Red-Green-Refactor. 실행 불가 검사는 "실행 불가" 명시.
> ⛔ same-canvas 유지 / page-per-feature 회귀 금지 / dead button·no-op·front-only success 금지 / canonical truth 보호 / 별도 AI UI 신설 금지.

## 0. Truth Reconciliation (코드 실측 2026-06-10)
- **3 surface 액션 3겹 확인:**
  - 행 `_workbench/_components/sourcing-result-row.tsx` — `비교 추가`(PenLine) + `견적 담기`(FileText). (유지)
  - 퀵뷰 `_workbench/_components/product-detail-summary.tsx` — `비교 후보에 추가`/`견적 후보에 추가` 액션바(L204-239) + 약한 `전체 상세 페이지` 텍스트링크(L242-251). **행 복제 = 제거 대상.**
    - 퀵뷰 호출부: `sourcing-context-rail.tsx`(L88, 퀵뷰=소싱 dock, toggle 전달) / `request-review-window.tsx`(L426, compact, 별 surface).
  - 상세 `app/products/[id]/page.tsx` — `견적 담기` + `바로 비교`(L1016, 데스크탑) + `찜하기`(L1027). 모바일 하단바 `비교 추가/제거`(L1282).
- **§2 code-confirm 종결:**
  - GRADE: `product.grade` **직속 필드**(기본 "Research Grade", L111). 배지 2곳(L348, L372) + 스펙블록(L507-512). "E" 노출이 이 필드 값인지 = **호영님 확인 필요**(wholesale 제거 시 legit 스펙 손실).
  - "AI로 생성"(사용 용도, L581-611): `POST /api/products/[id]/usage` = GPT 호출, **persist 안 함**(route db write 0) → 로컬 state만, 리로드 소실. 별도 AI 버튼 = 관통원칙 위반 + non-persist soft-fake. → **버튼 제거**(승인). `product.usageDescription` DB값은 유지 노출(L617-619).
  - 연관추천 `PersonalizedRecommendations`: score=빈도 카운트(deterministic), 유사도 fake 배지 이미 제거(`acef7d97`) → **이미 정합, 무손**.
  - 찜: `/api/favorites` 실연동(L142/168). 리뷰: `ReviewSection`(L1048) liquidity 0. → **둘 다 제거**(승인). 라우트·API 보존, 진입점만 차단.

## 1. Priority Fit — P2 (§1-2④⑤⑥⑦). (b) 종결 후 진입.
## 2. Work Type — Design Consistency + Workflow wiring(액션 surface 역할 분리). Scope Medium.

## 3. Canonical / Surface
- same-canvas: 신규 페이지 0. 기존 row/peek/detail 수정만. canonical(compare/quote store·favorites/review API) 보존, **라이브 진입점만** 조정.
- 승인 결정: AI생성 버튼 제거 / 찜·리뷰 제거 / GRADE는 호영님 값 확인 후 P3.

## 4. Phases (TDD)

### Phase 0: Truth Lock — [x] Complete (위 §0)

### Phase 1: ① 퀵뷰 액션 정리 — [x] Complete
- **🔴 RED:** sentinel — (a) `product-detail-summary` 액션바 `showCandidateActions !== false` 게이트, (b) `sourcing-context-rail`이 peek에 `showCandidateActions={false}` 전달(퀵뷰 후보 추가 억제), (c) `전체 상세` = 약한 링크 아닌 **강한 primary 버튼**, (d) 회귀: row의 `비교 추가`/`견적 담기` 보존.
- **🟢 GREEN:** peek에 `showCandidateActions?: boolean`(기본 true) 추가 + 액션바 게이트. 약한 `전체 상세 페이지` 링크 → 강한 primary `전체 상세 보기` Button(전진 CTA 단일화, dead peek 방지). rail에서 `showCandidateActions={false}`. request-review-window는 무변경(기본 true 유지).
- **✋ Gate:** 퀵뷰 후보 추가 0, dead 전진 CTA 0, row 무회귀, esbuild clean.
- **Rollback:** peek/rail revert.

### Phase 2: ② 라벨 통일 — [x] Complete
- **🔴 RED:** sentinel — 표준 쌍 `비교 추가`/`견적 담기`만. 금지 동의어 0: `비교 후보에 추가`·`견적 후보에 추가`(P1서 제거)·`바로 비교`. 상태라벨 `비교 후보에 포함됨`/`견적 후보에 포함됨` → 통일.
- **🟢 GREEN:** 상세 `바로 비교`(L1016) → `비교 추가`. peek 상태라벨 통일(`비교에 포함됨`/`견적에 포함됨` 등 단일 어휘). row/product-card/compare 표준 쌍 확인.
- **✋ Gate:** 금지 동의어 grep 0, 정렬/토글 로직 무손, esbuild clean.
- **Rollback:** 라벨 swap revert.

### Phase 3: ③ 상세 정리 — [x] Complete (GRADE 포함 — §11.344 확장)
- **🔴 RED:** sentinel — `AI로 생성` 버튼 부재 + `product.usageDescription` 노출 유지, `찜하기`/`Heart` 부재 + `toggleFavorite` 진입점 제거, `ReviewSection` 미렌더(import/컴포넌트 파일은 보존), `AlternativeProductsSection`/`PersonalizedRecommendations` 보존.
- **🟢 GREEN:** AI생성 버튼 블록 제거(usageDescription empty는 컴팩트 "미등록"). 찜하기 버튼 제거(favorites API/route 보존). ReviewSection 렌더 제거(연관추천 2종 유지). **GRADE: 호영님 'E' 값 확인 micro-step 후** — 내부 A~E 누출이면 제품 surface grade 숨김, legit 스펙이면 유지.
- **✋ Gate:** 별도 AI UI 0, dead button 0, 연관추천 무손, esbuild clean.
- **Rollback:** 상세 블록 revert.

### Phase 4: Smoke / Rollback / 핸드오프 — [~] sandbox 검증 완료 / 클로드코드 push 대기
- **🟢 GREEN:** vitest GREEN + esbuild clean. 변경 파일 패치/present_files(wholesale 교체 금지 — 호영님 env 드리프트 보존).
- **✋ Gate:** rollout 안전, rollback 문서화.

## 5. Out of Scope (⚠️ 금지)
- 이미지 placeholder·가격 문의(§catalog A 트랙). 헤더 뒤로가기·가짜추천(별 항목/이미 처리). ~~/app/compare 중복 라우트(§1-2⑥ = 별도 micro, 필요 시 후속)~~ — **§1-2⑥ done-by-retire (§11.381c, 2026-06-10): /app/compare 포함 compare 4라우트 retire 로 트랙 소멸. ④⑤는 유효 유지.**
- 찜·리뷰 API/route/컴포넌트 파일 삭제(진입점만 차단, 코드 보존).

## 6. Risk
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| peek 공유 컴포넌트 변경이 request-review-window 회귀 | Med | Med | showCandidateActions 기본 true → 그 surface 무변경, sentinel 회귀 가드 |
| GRADE wholesale 제거로 legit 스펙 손실 | Med | High | 호영님 값 확인 micro-step 선행, 확인 전 grade 손 안 댐 |
| 라벨 swap이 정렬/토글 로직 깨뜨림 | Low | Med | 라벨 텍스트만 swap, 핸들러 무변경, esbuild/sentinel |

## 7. Rollback — phase별 파일 revert. compare/quote store·favorites/review API·route는 전 과정 불변.

## 8. 핸드오프 — page.tsx 등 wholesale 교체 금지. 패치(git apply)로 적용. 신규 sentinel 파일은 추가.

---

## 9. 샌드박스 검증 (2026-06-10)
- 신규 sentinel `sourcing-product-surface.test.ts` **12/12 GREEN**. §11.344 기존 `grade-hidden-344.test.ts` **4/4 무회귀**.
- 수정 3파일 esbuild 구문 clean. 수정 파일 읽는 기존 sentinel(back-affordance/detail-entry-325b/quote-price-338/sds-348b1/coa-348b1/§11.320 rail audit) 무회귀.
- ⚠️ 선행 red((b)/본 트랙 무관): `inventory-context-panel-restructure-320` 2건(배너 3case·터치영역) = `inventory-context-panel.tsx`(미수정) 대상 드리프트. 클로드코드 확정 대상.
- 전체 tsc -p / lint = 샌드박스 타임아웃 → 실행 불가, 클로드코드 확정.

## 10. GRADE 결정 (§1-2⑤ 해소 — 호영님 'E' 값 확인 불요)
- **발견:** §11.344가 이미 "자사 grade(A~E) = 제품 surface UI 비노출, 데이터(product.grade) 보존"을 잠금(row+peek 적용). 호영님이 본 상세 "E" = **§11.344에서 누락된 상세 페이지**가 product.grade(=자사 등급) 그대로 노출한 것.
- **조치:** §11.344를 상세 페이지로 일관 확장 — 배지 2곳 + 스펙 'Grade' 행 제거(게이트 조건 grade 제거), `product.grade` 데이터/DB는 불변. sentinel 추가(`{product.grade}` 렌더 0).
- canonical 결정 기존 lock이라 신규 product 판단 아님 → 재질의 불요. 이견 시 rollback(grade 블록 복원) 단순.

## 11. 핸드오프 (wholesale 교체 금지 — 호영님 env 드리프트 보존)
- 패치(git apply, HEAD 기준, 재적용 검증 OK):
  - `outputs/product-detail-summary.surface.patch` (5 hunks)
  - `outputs/sourcing-context-rail.surface.patch` (4 hunks)
  - `outputs/products-id-page.surface.patch` (12 hunks)
- 신규 파일 그대로 추가: `apps/web/src/__tests__/regression/sourcing-product-surface.test.ts`.
- 커밋(분리 권장): `feat(sourcing) §1-2④⑤⑥⑦ #product-surface-cleanup — 퀵뷰 후보추가 제거·전체상세 primary / 라벨 통일(비교 추가·견적 담기) / 상세 AI생성·찜·리뷰 제거 + grade §11.344 확장`.
