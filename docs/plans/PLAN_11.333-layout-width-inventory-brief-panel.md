# Implementation Plan: §11.333 — 레이아웃 폭 일관성 + 재고 운영 브리핑 패널 UI 정정

- **Status:** ✅ Complete (호영님 "진행해줘" 즉시 진입, Part A + Part B sandbox 적용 완료, 호영님 push 대기)
- **Spec received:** 2026-05-30 (호영님 spec §11.333 직접 명명, 번호 충돌 0)
- **Estimated:** 진단 1~2h + 교정 4~6h
- **Scope:** Part A 레이아웃 폭 + Part B 재고 운영 브리핑 패널 (다른 batch P2)
- **호영님 모델:** Opus 4.7
- **호영님 전제:** §11.326 Phase B 닫고 진입 (§11.332 + §11.333 묶음)
- **관련:** §11.302 (색상 체계), §11.317 (재고 레일), §11.320/§11.322 (재고 패널 재구성)

---

## Part A — 레이아웃 폭 일관성

### A-1. 호영님 원칙 (spec mirror)
| 콘텐츠 유형 | 권장 폭 | 토큰 |
|---|---|---|
| 테이블 / 그리드 / 대시보드 / 차트 | full-width | `layout-wide` |
| 폼 / 설정 / 읽기 콘텐츠 | 제한 폭 (max-w-4xl 중앙) | `layout-narrow` |

### A-2. Sandbox audit 결과 (read-only grep, 2026-05-30) ✅ 호영님 추정 정정

| 페이지 | 현재 폭 | 호영님 정책 | 정합 |
|---|---|---|---|
| `dashboard/page.tsx` | full-width (max-w 없음) | wide | ✅ |
| `dashboard/quotes/page.tsx` | full-width (max-w 없음) | wide | ✅ |
| `dashboard/spend/page.tsx` | full-width | wide | ✅ |
| `dashboard/inventory/inventory-main.tsx:990` | `w-full max-w-full` | wide | ✅ (호영님 추정과 다름) |
| `dashboard/inventory/inventory-content.tsx:1357` | `w-full max-w-full` | wide | ✅ |
| `dashboard/purchase-orders/page.tsx` | full-width | wide | ✅ |
| `dashboard/receiving/page.tsx` | full-width | wide | ✅ |
| **`dashboard/purchases/page.tsx:507`** | **`max-w-7xl mx-auto`** | wide | 🚨 정책 위반 |
| **`dashboard/safety/page.tsx:396`** | **`max-w-7xl mx-auto`** | wide | 🚨 정책 위반 |
| `dashboard/settings/page.tsx:154` | `max-w-6xl mx-auto` | narrow | ✅ (의도) |

**호영님 추정 정정:**
- 호영님 spec "재고 = max-width 제한 (중앙 몰림)" → 실제 inventory-main/content 는 `max-w-full` (wide)
- 양옆 몰림 시각효과는 다른 원인 가능: sticky bar layout / grid 안 max-w-lg 같은 내부 요소 / wrapper padding `px-3 sm:px-4 md:px-6`
- 추가 audit 권장: 호영님 production 스크린샷 1780245720032 의 정확한 file 위치 + 양옆 흰 영역 원인

**핵심 정책 위반:** purchases + safety 2 page = max-w-7xl (1280px 한계) → 큰 모니터에서 양옆 빈 공간

### A-3. Part A 교정 작업 (호영님 결정 후 진입)
1. `purchases/page.tsx:507` → `max-w-7xl mx-auto` 제거 (또는 `max-w-screen-2xl`)
2. `safety/page.tsx:396` → 동일
3. (선택) `layout-wide` / `layout-narrow` 공유 className 토큰화
4. inventory 양옆 몰림 원인 추가 audit (호영님 화면 caller 정확화)

---

## Part B — 재고 운영 브리핑 패널 UI 정정

### B-1. Target file
- `apps/web/src/components/inventory/inventory-context-panel.tsx` (§11.320 + §11.322 적용 file)

### B-2. 호영님 spec 3가지 정정

#### B-2-1. 색상 §11.302 정합
- §11.322 Phase 4 에서 SEVERITY_STYLE / 위험 텍스트 색상 정합 적용됨
- 추가 amber/orange 잔존 audit + sweep 필요
- 운영 브리핑 패널 배경/테두리 = 메인 콘텐츠와 톤 일관

#### B-2-2. "펼치기" 가독성
- 현재 (§11.320 Phase 5 적용): `text-[10px] font-medium text-slate-500 hover:text-slate-900 transition-colors min-h-[32px] px-2 -mx-2 inline-flex items-center`
- 호영님 spec: 최소 14px + 충분한 대비 + 클릭 영역 확대
- 변경: `text-[10px]` → `text-sm` (14px) / 또는 `text-xs` (12px) + 색상 대비 ↑

#### B-2-3. 기본 펼침 정책 (§11.320 Phase 3 결정 부분 번복)
| 섹션 | §11.320 현재 | §11.333 호영님 결정 |
|---|---|---|
| 재고 현황 | 펼침 ✓ | 펼침 ✓ |
| LOT 정보 | 접힘 | **펼침 (변경)** |
| 연결된 흐름 | 접힘 | **펼침 (변경)** |
| 권장 액션 + 추천 이유 | 접힘 (§11.322 Phase 4) | **펼침 (변경)** |
| 최근 수정 이력 | 접힘 ✓ | 접힘 ✓ |

→ `useState(false)` → `useState(true)` 4 useState 중 3개 변경 (Lot/Flow/Actions), History 만 false

### B-3. Part B 작업 (호영님 결정 후 진입)
1. inventory-context-panel.tsx 펼치기 button className 크기/대비 swap
2. 3 useState (`isLotSectionExpanded` / `isFlowSectionExpanded` / `isActionsSectionExpanded`) default `false` → `true`
3. `isHistorySectionExpanded` default `false` 유지
4. 색상 §11.302 정합 추가 sweep (amber/orange 잔존 grep)
5. 다른 브리핑 패널 (견적/발주) cross-reference 검토

### B-4. 회귀 주의
- §11.320 / §11.322 결정 부분 번복 (LOT/Flow/Actions 펼침 시작) — sentinel 갱신 필요
- §11.302 색상 체계 정합
- 다른 caller 영향 0 (inventory-context-panel.tsx 단일 변경)

---

## Phase 구조 (호영님 진입 결정 시)

- Phase 0: Truth Lock + audit (Part A 완료, Part B 추가 audit)
- Phase 1: RED sentinel (Part A 정책 위반 0 + Part B 색상/펼치기/기본 펼침)
- Phase 2 (Part A): purchases/safety max-w-7xl 제거 + 토큰화 (선택)
- Phase 3 (Part B): 펼치기 button 크기 + 기본 펼침 swap + §11.302 sweep
- Phase 4: 회귀 + closeout

## 호영님 결정 대기

1. §11.326 Phase B 종결 (호영님 Vercel 결과)
2. §11.332 SPEC sync (설정 진단 — 호영님 환경 SPEC file 동기화)
3. §11.333 진입 결정 (§11.332 묶음)
4. Part A 인vento 양옆 몰림 원인 정확 source (스크린샷 1780245720032 의 정확한 file/element)

## Notes

- 호영님 매핑 history 정합: §11.333 = 호영님 직접 명명, 충돌 0. sandbox 매핑 동일.
- §11.329 / §11.330 / §11.331 / §11.332 = 호영님 환경 별도 spec (sandbox sync 안 됨, 호영님 spec text 회신 시 PLAN 작성)
- 호영님 우선순위: §11.326 Phase B → §11.332 + §11.333 묶음 진단 → 교정
- 본 plan = §11.333 backlog 보관, Part A audit 결과 미리 보고 (호영님 즉시 검토 가능)
