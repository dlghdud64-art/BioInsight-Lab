# Implementation Plan: 전역 필터 통일 — 툴바 인라인 필터 바 · 전 화면 이식 (§global-filters)

- **Status:** ✅ Complete (2026-07-24) — P0~P3 이식(대표 3화면 인라인 통일·공용 FilterBar) + P4 스코프축소·P5 백로그 종결
- **Started:** 2026-07-23
- **Last Updated:** 2026-07-23
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 truth 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **원칙(호영님 확정):** 전 화면·전 뷰포트 필터 통일 · 세로 4단 필터 패널 금지 · 라벨 없는 "전체" 금지 ·
  단일선택 ≤7 = 드롭다운 / 8+·멀티 = 바텀 시트 · **필터 트리거는 공용 컴포넌트 — 화면별 중복 구현 금지**

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 확정 지시(2026-07-23): "필터 전역 바꾸는걸로 가자" + "모바일 아니고 웹도" = b(전 화면) + a(활동
  로그 데스크톱) 흡수, a = Phase 파일럿
- 기준 프로토타입 `전역 필터 셀렉트 개선.dc.html`:
  - **데스크톱 = 2a 툴바 인라인 필터 바** — 검색과 같은 행에 트리거 가로 배치, 라벨 병기(`카테고리 · 전체`),
    세로 4단 패널 금지, 활성 필터만 파란 강조, 활성 칩 행(적용 시만) + 결과 건수 + 초기화
  - **모바일 = 한 줄 칩 트리거 + 바텀 시트** (§mobile-logs 활동 로그 기구현 패턴)
  - 열린 드롭다운 = 전역 토큰(흰 패널·그림자 `0 12px 32px rgba(15,23,42,.14)`·44px 행·선택 ✓
    `#eff6ff`/`#1d4ed8`) — **select.tsx 기적용 완료**(§mobile-logs d6f8f55b·d51def34·f4fa09de,
    computed rgb 프로덕션 실증)
- 핸드오프 `모바일 활동 로그 핸드오프.md` §3(전역 토큰 표·사용 규칙)

**Secondary References:**
- §mobile-logs 세션 실측 스크린샷: reports 필터 = 세로 4단 팝오버(2a 위반 대표) · inventory 위치/상태
  팝오버 · audit 데스크톱 Select 2(라벨 없는 "전체" 위반)
- PLAN_mobile-logs.md · PLAN_reports-honesty.md (접촉 화면 최신 상태)

**Conflicts Found:**
- §mobile-logs P3 결정 "데스크톱 Select/멤버 칩 보존(회귀 0 원칙)" ↔ 본 트랙 — **의도적 폐기**
  (호영님 지시, 스코프가 '회귀 방지'에서 '전 뷰포트 통일'로 격상). PLAN_mobile-logs 는 기록 유지(무수정).
- 미확보 truth 1건: `전역 필터 셀렉트 개선.dc.html` 원본 파일 — P0 에서 operator 확보·스펙 대조.
  미확보 시 호영님 인용 스펙(§상단 2a 서술)을 잠정 계약으로 사용하고 원본 확보 시 대조 정정.

**Chosen Source of Truth:**
- 프로토타입 2a + 핸드오프 §3 + 기적용 select.tsx 토큰. 필터 상태의 canonical 은 각 화면 기존
  state/URL 파라미터 — 공용 컴포넌트는 **표시·트리거만 소유, 필터 로직/상태는 화면 소유 유지**.

**Environment Reality Check:**
- [x] main HEAD(§reports-honesty 종결 69bf18f3 이후) · F9 격리/실 vitest · F10 build 가용
- [x] 프로덕션 스모크 경로: sandbox(Claude in Chrome, admin)

## 1. Priority Fit
- [x] Post-release / Design Consistency — 비블로커. §mobile-logs 패턴 신선할 때 진행 효율 최대.
- 진행 중 P1 급 이슈 발생 시 화면 이식 단위로 중단 가능(phase 독립 rollback).

## 2. Work Type
- [x] Design Consistency · [x] Feature(공용 컴포넌트) · [x] Web + Mobile(반응형 분기) · [ ] 모델/API 변경 0

## 3. Overview

**Feature Description:**
전 대시보드 화면의 필터 UI 를 단일 패턴으로 통일 — 데스크톱 2a 툴바 인라인 필터 바, 모바일 칩 한 줄+
바텀 시트, 열린 패널은 전역 select 토큰. 공용 컴포넌트 추출로 화면별 중복 구현 제거.

**Success Criteria:**
- [ ] 공용 컴포넌트(FilterBar·FilterSheet 계열 ≤3개)로 전 대상 화면 이식 — 화면별 자체 필터 트리거 0
- [ ] 데스크톱: 검색 동일 행 인라인 트리거 · 라벨 병기(`카테고리 · 전체`) · 세로 다단 필터 패널 0 ·
      활성 필터만 파란 강조 · 활성 칩 행(적용 시만) + 결과 건수 + 초기화
- [ ] 모바일: 칩 한 줄 가로 스크롤 + 8+/멀티 바텀 시트(`필터 적용 · N개`) — 활동 로그 패턴 동일
- [ ] 라벨 없는 "전체" 전 화면 0 · 회색 채색 패널 0(기완료 토큰 승계) · 터치 44px+
- [ ] 각 화면 필터 실동작 무회귀(적용·해제·건수) · baseline-delta 0
- [ ] 이식 안 된 화면은 P5 백로그에 명시(silent 누락 0)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 필터 로직/서버 param 변경(표시 계층만 — canonical 필터 상태는 화면 소유)
- [ ] 검색 인풋 자체 리디자인 · 테이블/리스트 본문 변경
- [ ] admin/* 화면(운영자 내부 — 후속 판정) · 다크 패널(governance-dev) · disabled 컨트롤(settings 준비중)

**User-Facing Outcome:**
- 어느 화면이든 필터가 같은 위치·같은 문법·같은 패널로 동작 — 화면마다 다른 필터 UI 학습 비용 제거.

## 4. Product Constraints

**Must Preserve:**
- [x] 각 화면 필터 상태/URL 파라미터(canonical) · [x] same-canvas · [x] 기존 서버 param 계약
- [x] select.tsx 전역 토큰(§mobile-logs 완결분 — 재수정 금지)

**Must Not Introduce:**
- [x] page-per-feature · [x] 화면별 필터 트리거 중복 구현 · [x] dead button/가짜 필터
- [x] 공용 컴포넌트가 필터 로직/상태를 소유(표시·트리거만)

**Canonical Truth Boundary:**
- Source of Truth: 각 화면의 필터 state/URL 파라미터(무접촉)
- Derived Projection: 트리거 라벨(`카테고리 · 전체`)·활성 칩·건수
- Persistence Path: 없음(표시 계층)

**UI Surface Plan:**
- [x] Existing route section(각 화면 툴바 행 교체) + [x] Bottom sheet(모바일) — 새 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 공용 = 표시 계층만(controlled) | 화면별 필터 의미 특수성 수용·canonical 무접촉 | 화면별 wiring 코드 잔존(정당) |
| 공용 컴포넌트 ≤3개(트리거바·칩행·시트) | 과설계 방지 | 특수 케이스는 화면 로컬 조합 |
| 파일럿(활동 로그) → 게이트 → 확산 | 패턴 결함을 1화면에서 조기 발견 | 전체 완료까지 화면 간 일시 불일치(과도기 수용) |
| 화면별 커밋 분리 | 단독 revert 경로 | 커밋 수 증가(정당) |

**Dependencies:**
- Required Before: P0 인벤토리(대상 화면·예외 확정) · 프로토타입 원본
- Touched(예상): components/ui 신규 filter-*.tsx · audit·inventory·reports·quotes·purchase-orders 등
  page 레벨 툴바(P0 확정)

## 6. Global Test Strategy
- 신규 `global-filters-p1.test.ts` — 공용 컴포넌트 계약 + 화면별 이식 계약(이식 시 화면별 어서션 추가)
- 화면별 기존 sentinel GREEN 유지(F9) — 충돌 시 임의 진화 금지·판정 상신(§mobile-logs 관례)
- F10 build + 화면별 프로덕션 스모크(sandbox) + baseline-delta 0

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — ✅ Complete (2026-07-24)
- Status: [x] Complete — operator 실측(코드 변경 0). 대시보드 44 라우트 전수 코드 확인(추정 0).

#### P0-(a) 필터 보유 화면 전수 인벤토리 — **총 14 화면**
| 화면 | 필터 | 단일/멀티 | 항목수 | 현 트리거 | 서버/클라 | 데/모 분기 | 접촉 sentinel |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `admin` | role·category(+검색) | 단일×2 | ≤7 | shadcn Select×2 | **서버** | 없음 | 없음 |
| `analytics/monthly` | year | 단일 | ≤7 | shadcn Select | 클라 | 없음 | 없음 |
| `organizations/[id]` | memberStatus(세그)·activityActor | 단일×2 | 4/동적 | 세그+Select | 클라 | 없음 | org-activity-actor-role-matrix |
| `safety-spend` | period(+custom) | 단일 | 4 | Select+date | 클라 | 없음 | 없음 |
| `notifications` | activeCategory | 단일 | 7 | 세그먼트 pill | 클라 | 없음 | 없음 |
| `audit` | activityType·entity(+칩)·period·mode·sheetDraft(멀티) | 혼재 | 8+/6칩 | Select+칩+**바텀시트** | **서버** | **있음** | mobile-logs-p1 |
| `reports` | category·team·vendor·budget(+기간) | 단일×4 | ≤7 | **자체 팝오버**+활성칩 | 클라 | 있음 | reports-filter-redesign·mobile-reports-p1 |
| `safety` | chip(세그5)+검색+정렬(숨은 risk/msds/location 상태) | 단일 | 5칩 | 세그먼트 | 클라+서버프레임 | 없음 | preferences-safety |
| `quotes` | statusFunnel·quickStatus(멀티 Set)·mine·period | **멀티** | 5+칩 | 퍼널+**자체 팝오버**+칩 | **서버**+persist | 있음 | quick-filter-4a*·quotes-filter-toolbar-compact-259c·preferences-quotes-filter |
| `inventory` | location·status(7)·category(4)·owner·lotStatus | 단일 다수 | 7/4 | 데스크 Select+**모바일 Sheet** | **서버**+persist | **있음** | inventory-content-filter-plain-297f·inventory-filter-empty-state-361·preferences-inventory-locationcategory |
| `purchases` | queueTab | 단일 | 버킷 | **State-Split Tabs** | **서버**+persist | 있음 | preferences-purchases-orders |
| `purchase-orders` | activeTab+stat pills | 단일 | 버킷 | **State-Split Tabs** | **서버**+persist | 있음 | preferences-purchases-orders |
| `inbox` | module(5)·state(5)·owner(7) | 단일×3 | 5/5/7 | 세그먼트 pill×3 | 클라+URL동기 | 있음 | ops-console adapter |
| `work-queue` | ConsoleViewTabs(뷰모드) | 단일 | 뷰 | 세그먼트 뷰탭(열필터 아님) | 클라 | 있음 | __tests__/lib/work-queue/* |

#### P0-(a) 4버킷 분류
> ⚠️ **정정(2026-07-24, operator 실측 재분류)**: "라우트 존재 ≠ 필터 화면". grep 실측상 `purchase-orders`·`purchases`·
> `work-queue`는 **SelectTrigger 0 + State-Split 탭(PO_BUCKET_TABS·queueTab)/무필터** → **필터 화면이 아니라 탭 화면**이므로
> **§global-filters 스코프에서 제외**(탭→드롭다운 치환은 상태 스코프 재설계 = 별개 트랙). `inbox`·`notifications`는 Select가 아닌
> **세그먼트 pill + URL 동기** → 이식 시 결정 교체 성격(별도 판단). 이식 대상은 실제 Select/Popover 필터 보유 화면으로 한정.

- **✅ 이식 완료 (3)** — `audit`(P2 파일럿) · `reports`(P3-b) · `inventory`(P3-a)
- **인라인 드롭다운 이식 후보 (4)** — 단일 ≤7·데스크 툴바 Select: `admin` · `analytics/monthly` · `organizations/[id]` · `safety-spend`
- **잔여 Select/Popover 필터 이식 대상 (2~3)** — `quotes`(자식 컴포넌트 Popover+멀티 statusFilter, §9/P6 잠금·persist — **결정 교체 판정 필요**) ·
  `safety`(SelectTrigger 1 + 세그먼트 칩 + 숨은 Select 상태 — 로컬조합, 판정 필요) · (`inbox` 세그먼트 pill — 이식 시 결정 교체)
- **스코프 제외 — 탭/무필터 (3)** — `purchase-orders`(State-Split 탭) · `purchases`(탭) · `work-queue`(필터 없음). **필터 화면 아님.**
- **세그먼트 pill (2)** — `inbox`(3차원 pill+URL 동기) · `notifications`(단일 7 pill) — Select 아님, 이식 시 결정 교체·별도 판단.
- **바텀시트 (0)** — 순수 멀티/8+ 단독 화면 없음.
- **제외 (13)** — 필터 아님/검색전용/폼/설정/리다이렉트/dead: `collaboration`·`organizations`(검색전용)·`receiving/[receivingId]`·`settings`·`settings/enterprise`·`settings/plans`·`vendor/quotes`·`budget`·`stock-risk`(리다이렉트)·`grants`·`supplier`·`shared-links`·`inventory-main.tsx`(**dead**, 라우트 미사용)

#### P0-(a) 예외 9 회귀 위험 근거(요지 — 임의 이식 금지)
- `audit`: 시트 초안-확정 2단 상태 + 모드 토글 + 서버 param 3종 얽힘 · `reports`: §reports-filter-redesign 팝오버+활성칩 전용 레이아웃(오버레이 가드) · `safety`: 숨은 risk/msds/location 상태 + 서버 activeFrame hydration · `quotes`: 멀티 Set + URL 동기 + 서버 persist + §9/P6 잠금·정직 배지 · `inventory`: 데스크 Select+모바일 Sheet **이미 구현**(URL>서버 우선순위) = 표준 레퍼런스이자 최고위험 · `purchases`/`purchase-orders`: State-Split 탭=필터, 탭→드롭다운 치환은 상태 스코프 재설계 · `inbox`: 3차원 pill 전부 URL 양방향 동기(auto_open 포커스) · `work-queue`: 뷰-모드 전환(열 필터 아님).

#### P0-(b) 프로토타입 원본 — **repo 부재 확정**
- `전역 필터 셀렉트 개선.dc.html` repo 전역 부재(html 전수 grep 0). 계획서 §5 인용 스펙은 **잠정 계약** 유지(Risk 표대로 — 원본 확보 시 대조 정정). 호영님 업로드 시 2a 토큰·구조·상태 대조.

#### P0-(c) 공용 컴포넌트 3개 controlled 인터페이스 초안 (표시 계층만 · 필터 상태 = 화면 소유)
- `FilterDef = { key: string; label: string; options: {value; label}[]; mode: "dropdown" | "sheet" }`
  — **표시 모드 판정을 정의 계층이 소유**: `단일 && 항목 ≤7 → "dropdown"` · `멀티 || 항목 8+ → "sheet"`. **P0 판정표의 단일/멀티·항목수 열과 1:1 연동**(화면이 모드를 계산하지 않음).
- `FilterBar { filters: FilterDef[]; values: Record<key,val>; onChange(key,val); className }` — 데스크 툴바 인라인.
- `FilterChipRow { active: {key,label}[]; onClear(key); onClearAll }` — 활성 칩·초기화.
- `FilterSheet { open; onOpenChange; options; selected; onApply(next); title }` — 멀티/8+ 모바일 바텀시트.
- 3개 모두 **controlled**(props 주입) — canonical(각 화면 필터 상태) 침범 0.

#### P0-(d) sentinel 충돌 — 파일럿(audit 데스크톱) **충돌 0**(조건부)
- `mobile-logs-p1`(it 30) audit 참조 = **모바일 필터 P3 한 줄·바텀시트**(`md:hidden` 존) + select.tsx 토큰 + GUARD(모드토글·강등·데이터계약·GMP). **audit 데스크톱 Select 블록 markup 자체를 pin하는 어서션 0.**
- ⇒ 조건: ① 데스크톱 필터 블록만 교체 · ② 모바일 필터 한 줄(P3) 무접촉 · ③ select.tsx 재사용(토큰 유지) · ④ 모드토글/강등/데이터계약/GMP 무접촉.
- ⚠️ **모바일 칩행까지 통일 시** P3 어서션 **~6건**(필터 한 줄 컨테이너·바텀시트·활성 칩·`필터 적용 · N개`) **진화 판정 상신 필요**.

#### ⚠️ P2 스코프 정정 (P0-(d) 실측이 강제 — 호영님 2026-07-24 승인)
- **P2 파일럿 = audit 데스크톱 필터 블록만.** 계획서 P2 원문의 "모바일 칩행 공용 치환"은 **P2에서 제거**(모바일 필터 한 줄 P3 존 무접촉 → mobile-logs-p1 충돌 0 조건 준수).
- **모바일 칩행 공용 치환 = 진화 상신 승인 후 별도 커밋**으로 이동(P4 또는 P5 전 단계). P3 어서션 ~6건 진화가 선행 게이트.

- **✋ Gate:** [x] 인벤토리 전수(44 라우트 대조·누락 0) · [x] 예외 9 판정 근거 명기 · [x] 프로토타입 부재 확정(잠정 계약) · [x] 컴포넌트 인터페이스 초안(FilterDef mode 정의계층) · [x] sentinel 충돌 계수(파일럿 0·모바일 통일 시 ~6) · [x] P2 스코프 정정 반영
- **Rollback:** planning-only (코드 변경 0)

### Phase 1: Contract & RED — ✅ Complete (2026-07-24 · `00f8522a`)
- Status: [x] Complete
- 신규 `global-filters-p1.test.ts` — 공용 컴포넌트 실재·토큰 소비·controlled·파일럿 이식 계약 RED + P3 존 가드

#### P1 F9 실측 (operator 원문 실행)
| 파일 | 결과 |
| :--- | :--- |
| `global-filters-p1` | **계약 4 RED** (a)파일 실재 (b)FilterDef mode 유니온 (c)select.tsx 소비 (d→e 순) (e)audit filter-bar import / **가드 2 GREEN** (d)controlled useState 0 (f)audit P3 존(log-filter-row·log-filter-sheet·domain-chip) 보존 → `4 failed \| 2 passed (6)` |
| `mobile-logs-p1` | **30 GREEN** — 무회귀 |
- F10 불요(테스트 파일 단독).

#### P1 inventory 패턴 수용 여부 (인터페이스 조정분)
- inventory(`inventory-content.tsx`) 기구현 실측: 필터 값 = `string`("all"=비활성), `activeFilterCount = [f].filter(f !== "all").length`,
  데스크 `hidden md:flex` Select+Label병기(L757), 모바일 `Sheet side="bottom"`+초기화(L2042), 상태 = 화면 useState+URL+서버 persist(L170-212).
- **인터페이스 수용 확정(재발명 0)**: `FilterDef`에 `allValue?: string`(기본 "all") 1필드 추가로 inventory 규약 흡수 →
  `activeFilterCount = values[key] !== (def.allValue ?? "all")`. FilterBar(데스크)·FilterSheet(모바일 side=bottom)·FilterChipRow 매핑 직결.
- ⇒ P2 공용 컴포넌트는 **inventory를 표준 레퍼런스로 흡수**(신규 발명 아님). 파일럿은 audit 데스크톱이나 인터페이스는 inventory 규약 기준.

#### P1 파일럿 대상 좌표(P2 착수용)
- audit 데스크톱 필터 블록 = `hidden md:flex`(L757) + `SelectTrigger`(L759·772) — **P2 교체 대상**.
- audit 모바일 P3 존 = `log-filter-row`(L803)·`log-domain-chip-*`(L808·818)·`log-filter-sheet`(L911) — **무접촉**((f) 가드 강제).

- **✋ Gate:** [x] RED 실증(계약 4 정확 계수) · [x] 기존 전체 GREEN 유지(mobile-logs-p1 30) · [x] inventory 패턴 수용 판정
- **Rollback:** 테스트 revert(`00f8522a` 단독)

### Phase 2: 공용 컴포넌트 + 활동 로그 파일럿(=a 흡수) — ✅ Complete (2026-07-24 · A `bf5c787e`·B `52a963ae`)
- Status: [x] Complete — sandbox 프로덕션 런타임 검증 통과.
- **게이트 검증(sandbox 프로덕션 6항 PASS):** 데스크톱 인라인 바·라벨 병기·**활성 강조(computed cls)**·
  **8→4건 실필터링**·전역 select 토큰 승계 = 런타임 실측 PASS / 모바일 무회귀 = DOM+sentinel(mobile-logs-p1 30) 승계
  (뷰포트 실측 제약 → 증거 등급 구분: 데스크톱=런타임 / 모바일=정적 승계).
- 공용 filter-bar(데스크톱 인라인)·filter-chip-row·filter-sheet(바텀 시트) 구현(표시 계층·select.tsx 소비) ·
  audit 데스크톱 Select 2 → FilterBar 인라인 바 교체.
- **⚠️ P2 스코프 정정 준수(P0-(d))**: 모바일 칩행 공용 치환은 **P2에서 제외**(P3 존 무접촉). 계획서 원문의
  "모바일 칩행 공용 치환"은 진화 상신 후 별도 커밋으로 이동.

#### P2 F9/F10 실측
| 항목 | 결과 |
| :--- | :--- |
| `global-filters-p1` | **6/6 GREEN** (계약 4 RED→GREEN 전환 + 가드 2 유지) |
| `mobile-logs-p1` | **30 GREEN** — 모바일 P3 존 무회귀 |
| audit 접촉 6종 | 85 pass / **311b 1 fail = 기왕 "일시/ID" drift**(mobile-logs P2~P4 내내 동일·본 변경 무관) → delta 0 |
| F10 build | **EXIT 0** · `/dashboard/audit` ƒ Dynamic |

#### P2 구현 요점
- **커밋 A**(`bf5c787e`, 공용 3파일 additive·소비자 0 무해): `FilterBar`{filters,values,onChange}·`FilterChipRow`·`FilterSheet`(side=bottom·`필터 적용 · N개`·h-11). controlled(필터 useState 0, P1 (d) 유지). `FilterDef={key,label,options,mode:"dropdown"|"sheet",allValue?}` — inventory 규약 흡수.
- **커밋 B**(`52a963ae`, audit 파일럿): 데스크톱 `hidden md:flex` Select 2 → `FilterBar` + `AUDIT_DESKTOP_FILTERS`(옵션·값·라벨 원본 1:1, 서버 param 계약 무변경). 필터 state/파생 무접촉(표시 계층만). 초기화 버튼 보존. 모바일 `log-filter-row`/`log-filter-sheet`/`log-domain-chip-*` **무접촉**.
- 라벨 병기(`{label} · {현재값}`) → **라벨 없는 "전체" 해소**(P0 위반 사례 교정) · 활성(비-all) 파란 강조.

- **✋ Gate:** [x] 파일럿 계약 GREEN(6/6) · [x] audit sentinel delta 0(311b 기왕) · [x] mobile-logs-p1 30 · [x] F10 EXIT 0 · [ ] **sandbox 런타임 패턴 검증**(데스크톱 인라인 바·라벨 병기·활성 강조·모바일 무회귀) — **통과 전 P3 금지**
- **Rollback:** 파일럿 커밋 B 단독 revert(공용 A는 미사용 상태로 무해)

### Phase 3: 재고·리포트 이식 — ✅ Complete (2026-07-24 · a·b 양건 코드완료·런타임검증 대기)
- Status: [x] Complete — reports(b) `aadbec7c`·`8d89e2f2`·`e88c5345` / inventory(a) `ae30bddf`·`4b5bcbd4`. 화면별 런타임 스모크는 배포 후 sandbox.

#### P3-a inventory — ✅ 코드 완료 (§11.297f 진화 승인·2026-07-23)
- **결정 교체 승인(호영님)**: §11.297f 필터-드롭다운 패널(`필터` 버튼 → `isFilterDropdownOpen` → `role="menu"` 절대배치 패널)
  → §global-filters 데스크톱 공용 FilterBar 인라인(reports 팝오버 폐기와 동종).
- **커밋 2분리**: `ae30bddf`(a1 297f sentinel 진화 — 드롭다운패널 pin → FilterBar 인라인·부재-lock) ·
  `4b5bcbd4`(a2 데스크톱 패널→FilterBar).
- 구현: 데스크 필터-드롭다운 패널(위치/상태 Select 내장) → `inventoryDesktopFilters` FilterBar(옵션·값·라벨 1:1).
  `isFilterDropdownOpen` useState·`Filter` 아이콘 미사용 제거. **모바일 Sheet(L2042)·`?filter`/서버 persist(L188-212)·
  statusFilter 우선순위 무접촉**. activeFilterCount 파생·초기화(위치/상태/카테고리 리셋) 유지.
- **F9**: 297f(진화)·filter-empty-state-361·preferences-inventory-locationcategory·global-filters-p1 6/6·action-menu-297d·
  traffic-light-283c = **26 GREEN**. **F10 EXIT 0**. `filter-empty-state-361`은 값 계약(setLocationFilter("all") 등)이라 무접촉 확인.

#### P3-b reports — ✅ 코드 완료(런타임 검증 대기)
- **결정 교체**(호영님 07-11 §reports-filter-redesign 팝오버 접기 → 07-23 §global-filters 인라인, 승인).
- **커밋 3분리**: `aadbec7c`(b1 reports-filter-redesign 진화) · `8d89e2f2`(b1b **operator 캐치** — mobile-reports-p1이
  `SlidersHorizontal` 팝오버아이콘도 pin, 동일 결정 교체로 진화) · `e88c5345`(b2 데스크톱 Popover→FilterBar).
- 구현: 데스크 `filterControls` 팝오버 폐기 → `reportDesktopFilters` FilterBar 인라인(옵션·값·라벨 1:1, 필터 state/파생 무변경).
  기간 프리셋 세그먼트·activeFilterCount·활성 칩·clearAllFilters 유지. **모바일 = mobile-report-view 현행 팝오버 유지**(P2 스코프정정).
  미사용 import(Popover·SlidersHorizontal) 정리.
- **F9**: reports-filter-redesign(진화)·global-filters-p1 6/6·mobile-reports-p1(진화)·purchase.contract 19·dashboard-surface-unify = **37 GREEN**. **F10 EXIT 0**.

- **✋ Gate:** [x] reports F9/F10 · [ ] **sandbox 런타임 스모크**(reports 데스크 인라인 바·실동작·모바일 무회귀) — P4 진행 전 필수 ·
  [x] inventory(a) 297f 진화 승인·이식 완료
- **Rollback:** 화면별 커밋 revert(reports b2 `e88c5345` 단독 / 진화 b1·b1b 별도)

### Phase 4: 발주·견적 + 잔여 화면 이식 — ⛔ 미착수(스코프 축소, 호영님 2026-07-24 (a) 마감 승인)
- Status: [-] 미착수 — 발주(purchase-orders)는 P0 정정으로 **탭 화면=대상 아님** 판명. 잔여는 P5 백로그 이관.

### Phase 5: 전역 스모크 · 종결 — ✅ Complete (2026-07-24 · P3 완료분 마감)
- Status: [x] Complete — 대표 3화면 인라인 통일 + 공용 FilterBar 확립으로 디자인 일관성 목표 달성. 잔여 백로그 명시(silent 누락 0).
- **완료(프로덕션 런타임 게이트 GREEN 실증):** `audit`(P2 파일럿) · `reports`(P3-b) · `inventory`(P3-a) 데스크톱 인라인 바 +
  공용 `filter-bar`/`filter-chip-row`/`filter-sheet` 확립(`FilterDef` mode·allValue 규약, controlled).
- **증거 등급:** 데스크톱 런타임 실측(3화면 프로덕션, reports·inventory persist 복원 실증) / 모바일 정적 승계(sentinel).
- **⚠️ P5 백로그(미이식·명시 존치 — 신규 화면은 공용 컴포넌트로 자연 수렴):**
  - **Select/Popover 이식 대상 (2)**: `quotes`(결정 교체 + §9/P6 잠금 + 멀티 Set + URL 양방향 + 서버 persist 얽힘 — **고위험**) ·
    `safety`(세그먼트 칩 + 숨은 risk/msds/location Select 상태 + 서버 activeFrame — 로컬조합, 실익 낮음)
  - **인라인 드롭다운 후보 (4)**: `admin` · `analytics/monthly` · `organizations/[id]` · `safety-spend`(저빈도 내부 화면)
  - **세그먼트 pill (2)**: `inbox` · `notifications`(Select 아님 — 이식 시 결정 교체·별도 판단)
  - **스코프 제외 (3, 대상 아님)**: `purchase-orders` · `purchases` · `work-queue`(State-Split 탭/무필터)
- **판단 근거:** 목표(디자인 일관성·공용 컴포넌트) 달성 · 잔여 2화면은 고비용저ROI(결정 교체+다수 sentinel 진화+persist 회귀 위험).
  재개 시 각 화면 상신(현 구조·sentinel·결정 교체 여부) 선행 — P3 관례(임의 이식 금지).
- **✋ Gate:** [x] 3화면 인라인 통일 런타임 GREEN · [x] 공용 FilterBar 확립 · [x] baseline-delta 0 · [x] 전역 select 토큰 승계(§mobile-logs 완결분·재수정 0) · [x] 백로그 silent 누락 0
- **Rollback:** phase별 커밋 revert(마이그레이션 0)

## 8. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 화면별 필터 의미 특수성(기간 프리셋·예산·날짜범위) | High | Med | P0 예외 판정표 — 1:1 이식 불가는 로컬 조합 허용(공용 토큰만 강제) |
| 기존 sentinel 대량 접촉 | High | Med | 화면별 커밋 분리 · 충돌 시 진화 판정 상신(임의 진화 금지) |
| 공용 컴포넌트 과설계 | Med | Med | ≤3개 · 표시 계층 한정 · 파일럿 게이트에서 API 동결 |
| 과도기 화면 간 불일치 | 확정 | Low | phase 순서 공지·P5 백로그 명시로 수용 |
| 프로토타입 원본 미확보 | Med | Low | 호영님 인용 스펙 잠정 계약 → 원본 확보 시 대조 정정 |

## 9. Rollback Strategy
- 화면별/phase별 커밋 분리 revert. 공용 컴포넌트는 additive(미사용 시 무해). 마이그레이션 0.

## 10. Progress Tracking
- Overall: 0% · Current: P0 대기 · Next: P0 인벤토리 착수
- [ ] P0 · [ ] P1 · [ ] P2 · [ ] P3 · [ ] P4 · [ ] P5

## 11. Notes & Learnings
- [2026-07-23] 계획 생성(호영님 "생성"). b(전 화면) + a(활동 로그 데스크톱, 파일럿 흡수) 확정.
  §mobile-logs "데스크톱 Select 보존" 결정 의도적 폐기 기록. 전역 select 토큰은 기완료분 승계(재수정 금지).
