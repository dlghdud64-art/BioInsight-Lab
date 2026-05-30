# Implementation Plan: §11.324 — 랜딩 페이지(/search) Sourcing Result Triage 데모 정리

- **Status:** ✅ Complete (Phase 0~3 sandbox 완료, Phase 3 호영님 push 대기)
- **Spec received:** 2026-05-30 (호영님 spec §11.320 → 번호 충돌 매핑 §11.324)
- **Started:** 2026-05-30 (§11.312-b 종결 후 진입)
- **Completed:** 2026-05-30 (3 phase / ~2.5h)
- **Scope:** A안 (권장) — 데모 제거 + 가치 제안 중심 / 3 phases / small-medium
- **호영님 모델 권장:** Opus 4.7로 충분 (랜딩 단순화 + 컴포넌트 제거 + 신규 다이어그램 1개, 신규 로직 0)

---

## 🔄 Phase 0 Truth audit 결과 (2026-05-30 sandbox)

**Target file:** `apps/web/src/app/search/page.tsx` (340 lines)

**Triage 데모 영역 정확 line 매핑:**

| section | line | 처리 |
|---|---|---|
| triageGroups data (Exact Match/Cross-Vendor/Substitute/Blocked + Shortlist/Hold/Exclude) | 21-59 | **제거** |
| publicTriageStage / publicTriageAction state | 68-69 | **제거** |
| handleTriageAction callback | 117 | **제거** |
| handleStepAction callback | 124 | **제거** |
| 상단 띠 "무료 가입하고 비교·견적까지" | 132-144 | ✅ 보존 |
| 히어로 (제목 + 부제 + 검색창) | 146-183 | ✅ 보존 |
| **Triage 데모 section (4 카드 + Shortlist/Hold/Exclude + Step 2/3 button + live-state + compare panel)** | **185-286** | **🚨 전체 제거 (102 lines)** |
| 검색 예시 칩 (Example queries) | 288+ | ✅ 보존 |

**Triage 데모 세부 (line 185-286):**
- line 185-199: `<section data-testid="search-result-triage" aria-label="소싱 결과 분류">` 헤더
- line 200-245: triageGroups.map → 4 카드 (Shortlist/Hold/Exclude button × 4)
- line 246-250: Compare panel 안내문
- line 251-278: action-dock (Step 2 / Step 3 / 로그인 후 계속)
- line 279-285: live-state 영역 (publicTriageStage 표시)

**Import 정리 후보 (Triage 전용):**
- `Beaker / Microscope / Ban / RefreshCw / CheckCircle2` (line 8) — triageGroups icon, 다른 사용 0 이면 제거
- `savePendingAction` (line 10) — line 273 만 사용, 함께 제거
- `buildWorkbenchPath` — Triage action-dock line 271 사용

**§11.324 신규 신설:**
- 3단계 다이어그램 (① 검색 ② 비교 ③ 견적, 각 lucide-react icon + 1줄 설명)
- 큰 CTA "무료로 시작하기 — 30초 가입" (Link to `/auth/signin`)
- (선택적, 호영님 spec) 핵심 가치 3가지

**보존 (회귀 0):**
- `app/_workbench/search/page.tsx` (로그인 워크벤치) 영향 0 — 별개 surface
- `/products/[id]` 라우트 영향 0
- 비로그인 검색창 동작 (handleSearch) 보존
- 상단 띠 가입 banner 보존
- 검색 예시 칩 보존
- SEO/OG 메타데이터 보존 (page.tsx 외부)

---

## 🔖 번호 매핑 이력

- 호영님 spec 번호: **§11.320** (랜딩 페이지 /search Triage 데모 정리)
- 충돌: §11.320 이미 사용 (재고 상세 우측 패널 재구성, completed)
  · 기존: PLAN_11.320-inventory-context-panel-restructure.md ✅
- 새 매핑: **§11.324** (다음 미사용, §11.320~§11.323 모두 사용)
- 호영님 매핑 이력:
  · §11.315 → §11.320 (재고 상세 우측 패널)
  · §11.316 → §11.321 (재고 탭 세그먼트)
  · §11.317 → §11.322 (재고 상세 우측 레일 2차 고도화, 진행 중)
  · §11.306 → §11.312-b (소싱 sticky bar 보강)
  · §11.320 → **§11.324** (랜딩 Triage 데모 정리, 본 plan)

---

## 🎯 Spec Mirror (호영님 원본 spec)

### 1. 현상
비로그인 사용자 "무료로 시작하기" 진입 시 `labaxis.co.kr/search` 랜딩에 **실제 사용 UI** (Sourcing Result Triage 4 카드 + Shortlist/Hold/Exclude 액션 + Step 2/3 버튼) 그대로 노출.

### 2. 5 문제
| # | 내용 |
|---|---|
| A | 목적 불일치 — 랜딩 = 가치 제안 + 가입 유도인데 실제 UI 그대로 노출 |
| B | Dead button 위험 — Shortlist/Hold/Exclude/Step 2/3 비로그인 동작 불명 |
| C | 검색과의 단절 — 위 검색창 + 아래 데모 미연동 |
| D | 공간 비효율 — 데모 ~40%, 가입 CTA 상단 띠 1줄만 |
| E | 인지 부하 — 4 분류 × 3 액션 × 2 Step 압도 |

### 3. 개선 방향 A안 (권장)
- Triage 카드 제거
- 3단계 간단 다이어그램 (① 검색 / ② 비교 / ③ 견적)
- 검색창 유지 (실제 검색 가능, 결과는 가입 유도)
- 큰 가입 CTA "무료로 시작하기 — 30초 가입"
- dead button 0 — 모든 버튼 명확한 동작 (검색/가입/로그인)

### 4. A안 페이지 구조
1. 상단 띠 (기존 유지)
2. 히어로 (제목 + 부제 + 검색창 + 예시 칩)
3. 3단계 다이어그램 (검색/비교/견적, 각 아이콘 + 1줄 설명)
4. 핵심 가치 3가지 (선택적)
5. 큰 CTA + 보조 링크 (로그인)
6. 하단 (기존 검색 가이드 유지)

### 5. 회귀 주의
| 영역 | 주의 |
|---|---|
| `/app/search` 워크벤치 | 별개 표면 — §11.318-CORRECTION canonical 보존 |
| 로그인 상태 진입 | 비로그인 랜딩 vs 로그인 워크벤치 분기 명확 |
| SEO/OG 메타 | 마케팅 자료 유지 |

---

## 7. 진입 시 작업 계획 (호영님 활성화 후)

### Pre-진입 audit 필요 항목
- `labaxis.co.kr/search` 랜딩 페이지 정확 file path
  · 후보: `apps/web/src/app/search/page.tsx` (비로그인) vs `apps/web/src/app/_workbench/search/page.tsx` (로그인)
  · §11.318-CORRECTION canonical 표면 확인 필요
- Sourcing Result Triage 컴포넌트 import 출처
- 검색창 input 동작 (비로그인 검색 결과 routing)
- 가입 모달 / 가입 페이지 wiring 존재 여부

### 예상 3 phase 구조
- Phase 0+1: Truth Lock + RED sentinel (Triage 카드 제거 단언 + 3단계 다이어그램 + dead button 0)
- Phase 2: A안 적용 (Triage 카드 제거 + 3단계 다이어그램 신규 + CTA 강화)
- Phase 3: 회귀 + closeout (`/app/search` 워크벤치 영향 0 + SEO/OG 보존 + 모바일)

### Estimated effort
- Phase 0+1: 0.5h
- Phase 2 (A안 적용): 1.5h
- Phase 3 (회귀 + closeout): 0.5h
- **합계: ~2.5h**

---

## 8. Product Constraints

- ❌ dead button — 비로그인 상태 모든 버튼이 명확한 동작 (검색/가입/로그인) 필수
- ✅ same-canvas = 랜딩 단일 page, 새 page 0 (`/demo` 분리 안 함 = C안 거부)
- ✅ canonical truth = 비로그인 랜딩 vs 로그인 워크벤치 분기 명확
- ✅ 마케팅 페이지 = 가입 conversion 최대화

---

## 9. Risk Assessment

| Risk | 확률 | Impact | Mitigation |
|---|---|---|---|
| 비로그인 / 로그인 분기 충돌 | Med | High | Phase 0 audit — 비로그인 랜딩 vs 로그인 워크벤치 file path 확정 |
| Triage 컴포넌트 다른 surface 사용 (워크벤치) | Med | Med | Phase 0 grep import 사용처, 워크벤치 보존 |
| SEO/OG 메타 회귀 | Low | Med | Phase 3 검증 |
| 검색창 동작 변경(비로그인 결과 routing) | Low | Med | Phase 2 wiring 명확화 |

---

## 10. Pending — 호영님 결정 대기

- A안 vs B안 (정적 이미지 + 클릭 → 가입 모달) vs C안 (`/demo` 분리) — 호영님 spec "A안 권장" 명시, 활성화 시 재확인
- 3단계 다이어그램 아이콘 디자인 (lucide-react 후보: Search / Scale / FileText 등)
- 핵심 가치 3가지 (선택적) 포함 여부

---

## 11. Notes

- 호영님 message: "다음 트랙 진입하자 일단 추가 지시문도 전달" — 본 spec 은 추가 지시문 (backlog), 다음 트랙 = §11.322 Phase 5
- P2 release-prep 후순위 명시 — release-prep cleanup 완료 후 활성화 권장
- §11.318-CORRECTION (canonical 표면 결정) 와 cross-reference 필수 진입 시
- 본 plan = release-prep + §11.322 종결 + 호영님 활성화 결정 시 진입
