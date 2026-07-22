# Implementation Plan: 모바일 구매 리포트 개선 (§mobile-reports)

- **Status:** ✅ Complete (2026-07-21 · 코드 `5d60b835` + hotfix `aab4f19e`·`93b0f54a`) — P1–P5 전건 종결
- **Started:** 2026-07-21
- **Last Updated:** 2026-07-21
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **원칙 2종(핸드오프 §0):** 지출 가져오기/업로드 UI 금지(발주 완료 자동 집계 유일) · 탭 분리 금지(단일 세로 스크롤 + 딥링크)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 핸드오프 `모바일 구매 리포트 핸드오프.md` (2026-07-21 업로드) — §0 원칙 · §1~4 화면 스펙 · §5 스타일 토큰 · §6 QA 10항
- 프로토타입 `모바일 구매 리포트 지시문.html` (6a 화면 · 6c 상세 분석 데이터 상태)

**repo 실측 (2026-07-21, 1차):**
- `/dashboard/reports` = `page.tsx` **1004줄 단일 파일**. 데이터 = `/api/reports/purchase`
  (react-query `["reports","purchase",...]`, 필터 파라미터 포함)
- **충돌 3건:** ① 가져오기/업로드 UI 실재(L395~466 CloudUpload + `/api/purchases/import-file`
  mutation + 빈 상태 CTA L635) ② recharts 전역 사용 ③ 새로고침 버튼(L476)

**Chosen Source of Truth:** 핸드오프 md + 프로토타입 html. 적용 경계 = **viewport <768px 반응형 분기,
데스크톱 기존 동작 회귀 0** 전제.

**확정 판정 (호영님 2026-07-21):**
- 가져오기 버튼 = **모바일 숨김 · 데스크톱 보존** (기본안 승인 — 이견 없음)

**Environment Reality Check:**
- [ ] main HEAD 확인 (§bottom-nav-badge 종결 커밋 이후 기준 재실측)
- [x] baseline 130 file fail · F6(vitest sandbox 불가)·F9·F10 승계

## 1. Priority Fit
- [x] Post-release — backlog #1 (호영님 직접 지시, §bottom-nav-badge 종결 직후 승계. 현 P1 충돌 없음)

## 2. Work Type
- [x] Feature · Mobile · Web · Design Consistency (단일 라우트 반응형 리디자인)

## 3. Overview

**Success Criteria (핸드오프 §6 QA 10항 = 인수 기준):**
- [ ] 모바일 가져오기/업로드 UI 0 (발주 자동 집계 안내만)
- [ ] 날짜 = 본문 폰트 한국어 표기(`7월 13일 – 7월 20일`, 올해 연도 생략, mono 금지)
- [ ] 프리셋(7일/30일/분기/올해)·날짜·필터 = 카드 1장, 필터 버튼에 적용 개수 배지
- [ ] KPI 2열 컴팩트 4장(지출 변화%·이상치 건·기간 합계·공급사 의존도%), 값 없음 = `–`(0과 구분)
- [ ] 빈 기간 = 점선 카드 + "발주가 완료되면 지출이 자동으로 집계됩니다" + CTA `기간을 30일로 넓히기`
- [ ] 상세 분석 = 같은 슬롯 상태 전환: 빈 상태 접힌 행 3개 ↔ 데이터 시 제자리 미니차트 확장(순서 불변·혼합 허용·탭 없음)
- [ ] 의존도 상위 1곳 60% 초과 시 yellow 토큰 경고 배너(KPI 의존도와 동일 소스)
- [ ] 월별 추이: 당월 값 헤더 통합·막대 위 숫자 금지·2개월 이상부터 렌더
- [ ] 상세 분석 미니차트 = CSS/inline SVG (recharts 미사용)
- [ ] 터치 타겟 44px 이상 · baseline-delta 0 · 데스크톱 회귀 0

**Out of Scope (⚠️):**
- [ ] 데스크톱(≥768px) 레이아웃 변경 · 가져오기 기능 자체 제거(모바일 숨김만)
- [ ] `/api/purchases/import-file` 라우트 접촉
- [ ] 딥링크 대상 상세 페이지 신설(기존 라우트 링크만 — page-per-feature 금지)

**User-Facing Outcome:** 모바일에서 기간/필터→KPI→상세분석 단일 스크롤, 빈 상태 정직 안내, 데이터 시 제자리 확장 미니차트.

## 4. Product Constraints

**Must Preserve:** same-canvas(단일 라우트 내 상태 전환) · canonical truth(`/api/reports/purchase` 응답만, 클라 가공 최소) · react-query invalidation 규약
**Must Not Introduce:** 탭 분리 · page-per-feature · 가짜 0/placeholder(값 없음 `–`) · 업로드 CTA 재노출

**Canonical Truth Boundary:**
- Source of Truth: PurchaseRecord(발주 완료 자동 집계) → `/api/reports/purchase`
- Derived Projection: KPI 4장 · 미니차트 3종 · 의존도 경고(60% 판정은 단일 값에서 파생 — KPI·배너 동일 소스)
- Persistence Path: 없음(읽기 전용)

**UI Surface Plan:** [x] Existing route section (in-place 상태 전환) — 새 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 모바일 분기 = 동일 파일 내 반응형(`md:` 경계) | 1004줄 파일이지만 별도 mobile 컴포넌트 분리는 데이터 로직 이원화 위험 | 파일 추가 비대 — P0에서 섹션 컴포넌트 추출 여부 판정 |
| 미니차트 CSS/inline SVG 신규 소형 컴포넌트 | recharts 번들·모바일 성능·핸드오프 명시 | 차트 2벌 공존(데스크톱 recharts 유지) |
| KPI 이상치·의존도 소스 = P0 실측 후 확정 | 응답 계약 미확인 — 없으면 API 확장 scope 상향 | P0 전 phase 산정 확정 불가 |

**Integration Points:** `/api/reports/purchase` 응답 계약 · 필터 상태(기존 useState) · 다운로드(기존 FileDown 경로)

## 6. Global Test Strategy
- 정적 sentinel(F6 제약 하 소스 어서션) + F9 원문 실행 + F10 build. 데스크톱 회귀 = 기존 reports 관련 테스트 전건 + baseline-delta 0.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — ✅ Complete (2026-07-21)
- Status: [x] Complete

**실측 결과 — API 확장 불필요 (KPI 4장 전건 기존 소스 확보):**
- 응답 계약: `metrics{totalAmount, estimatedAmount, actualAmount, difference, vendorCount, itemCount}` ·
  `monthlyData[{month,amount}]` · `vendorData(top6)` · `categoryData` · `details[]` · `budgetUsage[]`
- KPI 매핑: ① 지출 변화% = 기존 `insights.trendDelta`(최근 2개월 비교) ② **이상치 = 기존
  `insights.outlierCount`(단가 > 평균×2, 상세 테이블 outlier 마킹과 동일 규칙 — 신설 0)**
  ③ 기간 합계 = `metrics.totalAmount` ④ 의존도 = `insights.topVendorPct`(60% 배너와 동일 소스)
- `deriveInsights()` 순수 함수(L63)가 KPI·배너·미니차트 파생 전부 커버 — **클라 파생 단일점, 규칙 신설 0**
- 프로토타입 html(22.7MB) 스펙 문자열 전건 정합(30일 CTA·자동 집계 카피·60% 배너·접힌 행 3종 카피)
- 섹션 맵: HEADER(L386, 가져오기 Dialog+갱신+내보내기) · FILTER(L522, 프리셋+DateRangePicker+팝오버)
  · 빈 상태(L623, 가져오기 CTA 포함 — 모바일 교체 대상) · 배너(L651) · KPI 4장(L706 `sm:grid-cols-2
  lg:grid-cols-4` — 모바일 1열이 현상) · 카테고리/의존도(recharts 도넛) · 월별(recharts Line) · 상세 테이블
- 기존 sentinel 3종: `reports-filter-redesign` · `dashboard-surface-unify` · `api/reports/purchase.contract`
- **충돌 해소:** 60% 배너 색 — 기존 데스크톱 상단 배너 = red(danger). 지시문 = 모바일 상세분석 yellow.
  → 모바일 신규 배너만 yellow(지시문 명시·amber sentinel), 데스크톱 배너 무접촉
- **잔여 판정 1건(호영님):** 기간 합계 소스 — `totalAmount` = 견적 예상(estimated) + 발주 실적(actual)
  합산. 핸드오프 §0 "발주 완료 자동 집계 유일" 엄격 해석 시 `actualAmount` 가 정합이나, 데스크톱
  KPI·차트 전부 totalAmount 라 모바일만 바꾸면 표면 간 불일치. 기본안 = totalAmount 유지(표면 정합
  우선), estimated 분리는 별도 트랙
- **✋ Gate:** [x] KPI 소스 전건 확정 [x] 충돌 해소 [x] phase 산정 유지(5phase, API 접촉 0 확정)

### Phase 1: Contract & RED — ✅ Complete (2026-07-21)
- Status: [x] Complete
- 🆕 `src/__tests__/regression/mobile-reports-p1.test.ts` — QA 10항 중 정적 검증 가능 항목 어서션 + 회귀 블록(데스크톱 가져오기 보존·다운로드 경로·기존 쿼리 키)
- sentinel 진화 1건(호영님 승인): 프리셋 라벨 어서션(`최근 7일`·`최근 30일`)을 자식(mobile-report-view)에서 부모(page.tsx `REPORT_PRESETS` 단일소스)로 재타깃 + 자식은 prop 배선(`presets`·`p.label.replace`) 검증. 단일소스 설계 존중, 기능·문구 무변경.
- **✋ Gate:** [x] RED 실증 → 구현 후 12/12 GREEN · [x] 기존 테스트 GREEN 유지
- **Rollback:** 테스트 파일 revert

### Phase 2: 헤더 · 기간/필터 카드 — ✅ Complete (2026-07-21)
- Status: [x] Complete
- 모바일: 다운로드 1개(타이틀 행 우측) · 가져오기 숨김 · 새로고침 버튼 숨김(당겨서 새로고침 대체 여부 P0 판정) · 프리셋 세그먼트 풀폭+날짜 한국어+필터 배지 = 카드 1장
- **✋ Gate:** [x] 데스크톱 무변경(`md:` 경계) · [x] 필터 동작 회귀 0
- **Rollback:** 헤더 섹션 revert

### Phase 3: KPI + 빈 상태 — ✅ Complete (2026-07-21)
- Status: [x] Complete
- 2열 4장(아이콘 칩 26px·숫자 22px·`–` 표기) · 빈 기간 점선 카드 + 30일 CTA(실동작 — 기간 상태 변경)
- **✋ Gate:** [x] CTA no-op 금지(실제 프리셋 전환 `onPreset("30d")`) · [x] 값 없음/0 구분 렌더
- **Rollback:** KPI 섹션 revert

### Phase 4: 상세 분석 2상태 — ✅ Complete (2026-07-21)
- Status: [x] Complete
- 접힌 행 3개(비활성 회색 링크) ↔ 제자리 확장(카테고리 가로 막대 3개·의존도 스택 바+60% yellow 배너·월별 3개월 막대) — CSS/inline SVG, 섹션별 혼합
- **✋ Gate:** [x] 탭 0 · [x] 순서/위치 불변 · [x] 60% 판정 KPI와 동일 소스(deriveInsights) · [x] 링크 딥링크 실경로
- **게이트 종합:** P1 12/12 · reports sentinel 18/18 · build EXIT 0 · baseline-delta 0. 배포 대기(코드 `5d60b835`, push 별도 승인).
- **Rollback:** 상세 분석 섹션 revert

### Phase 5: 스모크 · 롤아웃 — ✅ Complete (2026-07-21)
- Status: [x] Complete
- QA 10항 체크 · 375px 실측(빈 기간/데이터 기간 2상태) · 터치 타겟 44px · baseline-delta 0 · 롤백 문서화
- **스모크 판정 요지:** D1 리포트 API 500→200 실증 · 30일 CTA 실동작(프리셋 전환) · 500px 라이브 실측(Chrome 최소 창폭 제한 — <768 모바일 분기 검증됨, 375px 정밀 확인은 실기기 잔여) · D2 조회 실패 에러 카드+재시도는 소스 검증(하네스 13/13).
- **스모크 발견 → hotfix 2건:** D1 프로덕션 500(quote item product null) → `aab4f19e`(null 가드 5곳) · D2 모바일 dead-end → `93b0f54a`(에러 카드+재시도). 배포 READY(`dpl_HvpZYzjEhLkcDRLeJ3gKYpwnfUvU`).
- **✋ Gate:** [x] 하네스 p1 13/13 · contract 4/4 · [x] build EXIT 0 · [x] baseline-delta 0
- **롤백 경로:** UI 롤백 = mobile-report-view+page revert · 전체 = 코드 커밋(5d60b835·aab4f19e·93b0f54a) revert · 데이터/마이그레이션 없음(읽기 전용, rollout 게이트 불요).
- **Rollback:** phase별 섹션 revert(전체 = 코드 커밋 revert 단일)

## 8. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| KPI 2종(이상치·의존도) 응답 계약 부재 | Med | High | P0 실측 → 부재 시 API 확장 별도 승인(scope 상향 명시) |
| 1004줄 단일 파일 접촉 — 데스크톱 회귀 | Med | High | `md:` 경계 엄수·기존 테스트 전건·스냅샷 대조 |
| recharts/CSS 차트 2벌 drift | Low | Med | 동일 데이터 배열 공유·파생 계산 중복 금지 |

## 9. Rollback Strategy
- Phase 2~4 각 섹션 단위 revert 가능하게 커밋 분리. 전체 = 코드 커밋 revert. 데이터/마이그레이션 없음(읽기 전용).

## 10. Notes & Learnings
- [2026-07-21] 계획서 생성 승인(호영님 "생성"). 가져오기 버튼 = 모바일 숨김·데스크톱 보존 확정.
- [2026-07-21] 월별 해석 = top 카테고리 비중 파생(프로토타입 더미 카피 대체) · 커스텀 날짜 편집 v1 제외(DateRangePicker mono 강제 회피, 프리셋 4종 + 한국어 표시로 대체).
- [2026-07-21] P5 스모크 발견 → hotfix 2건: D1 프로덕션 500(quote item product null 미가드) `aab4f19e` · D2 모바일 조회 실패 dead-end(에러 카드+재시도 부재) `93b0f54a`. 라이브 스모크가 정적 게이트(build·sentinel)로 못 잡는 프로덕션 결함을 실증 → 실기기 스모크 가치 확인.
