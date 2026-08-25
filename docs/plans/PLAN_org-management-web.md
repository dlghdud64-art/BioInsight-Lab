# Implementation Plan: 조직 관리 (웹) 개선

- **Status:** ⏳ Pending
- **Started:** 2026-08-24
- **Last Updated:** 2026-08-24
- **핸드오프:** `조직 관리 (웹) — 구현 지시문` (호영님 업로드 2026-08-24)
- **시각 truth:** `조직관리 웹 개선 (단독).html` (22MB · 사무국 파싱 불가 — 시각 대조는 호영님/로컬 세션)

**CRITICAL**: 각 phase 완료 후 ① 체크박스 ② quality gate 전항 ③ Last Updated ④ Notes ⑤ 다음 phase.
⛔ gate 실패 상태 진행 금지 · 미해결 truth 충돌 상태 진행 금지 · dead button/no-op/placeholder success 금지

---

## 0. Truth Reconciliation

### 현행 실측 (2026-08-24 · 파일:줄 · 추정 0)

핸드오프 §0 의 다섯 문제는 전부 소스에서 확인됐다.

```
① DOM 해킹 탭 전환   [id]/page.tsx:596 · :691   document.querySelector(...).click() 2곳
② dead filter        [id]/page.tsx:343          if (memberStatusFilter === "inactive") return false
                                  :947~:967      칩은 렌더되고 카운트는 하드코딩 0
③ 가짜 실시간 신호    [id]/page.tsx:330          lastActive = m.status === "Pending" ? "초대 대기" : "오늘"
                                  :1019 · :1074  "마지막 활동" 열 · "활동 중" Badge 무조건 렌더
④ CTA 4개            [id]/page.tsx:589 · 601 · 610 · 617
⑤ 칩형 탭            [id]/page.tsx:718          TabsList bg-slate-100 + data-[state=active]:bg-white
                                  :717          defaultValue="overview" — uncontrolled (①의 원인)
리스트 레이아웃       page.tsx:502               lg:grid-cols-[1fr_280px] · 카드 2열 (:504)
```

파일 크기: `page.tsx` 760줄 · `[id]/page.tsx` 1,885줄.

### 🛑 Conflicts Found — 핸드오프와 저장소가 어긋나는 3건

**C1. 좌석 한도(§5)가 가리키는 데이터가 dead column 이다**

```
Organization.maxMembers (schema:63)    소비자 0 · 생산자 0   ← 코드 어디서도 안 읽고 안 쓴다
canonical 실물                          lib/plans.ts:172 PLAN_LIMITS[plan].maxMembers
                                        /api/billing 만 소비 중 (route.ts:55·64·73·187·257)
조직 상세가 부르는 API                   /api/organizations · .../members   ← billing 안 부른다
현행 추정 공식                          [id]/page.tsx:549 Math.max(totalMembers + 2, 10)
```
🔑 §reachability-needs-a-different-tool 의 세 번째 줄 그대로다 — 컬럼을 봤고 생산자를 안 셌다.
`organization.maxMembers` 를 읽으면 항상 null 이고 게이지가 **조용히** 거짓이 된다.
→ P0 결정: PLAN_LIMITS 를 어디로 실어올 것인가 (org API 응답 확장 vs 클라이언트 상수 참조).

**C2. "전역 밑줄 탭 규칙"(§2)의 선례가 둘인데 값이 다르다**

```
app/dashboard/analytics/page.tsx:500   border-b-[2.5px] border-[#2563eb]   ← 핸드오프와 일치
app/dashboard/quotes/page.tsx:3893     border-b-2 border-blue-600
```
전역 규칙이라기보다 선례 2건이고 불일치다. → P0 에서 정본 판정. 안 정하면 세 번째가 또 갈린다.

**C3. `조직 설정 핸드오프 §3`(§4 역할 드롭다운 토큰의 근거)이 이 저장소에 없다**

`docs/handoff/` 에 org·setting 문서 0건. → P0 에서 호영님께 문서 확인 또는 토큰 정본 재지정.

### Chosen Source of Truth

```
기능·문구·레이아웃   핸드오프 md (2026-08-24) — 가장 최신 판정
현행 코드 사실       실측 grep (위) — md 의 §0 서술과 전량 일치, 충돌 0
좌석 한도            lib/plans.ts PLAN_LIMITS  🛑 md §5 의 "플랜별 실제 한도" 는 이것이지
                     Organization.maxMembers 가 아니다 (C1)
탭 토큰              미정 (C2) — P0 판정 전까지 착수 금지
```

### Environment Reality Check
- [ ] repo/branch: `dlghdud64-art/BioInsight-Lab@main` · 사무국 = 워킹트리 구현, 로컬 세션 = 게이트·push
- [ ] 22MB HTML 은 사무국이 열 수 없다 — 시각 대조 주체는 호영님/로컬 세션
- [ ] vitest·tsc·push 는 로컬 세션 (VM 금지 규율 유지)

---

## 1. Priority Fit

- [x] **Post-release / UX 정합** — 릴리스 블로커 아님
- 우선순위 충돌: 인계 1순위였던 §purchased-falls-through-to-not-sent 의 **실행 축은 착수 전 봉합 완료**
  (호영님 판정 "isSelectable 차단만 먼저" · commit `0ac39adb`). 표시 축은 이월 상태로 남아 있다.
- 이 트랙이 우선하는 근거: ②③이 **사용자에게 없는 사실을 말하는 화면**이다. 위험도는 발주 재전송보다
  낮지만(외부 부작용 0) 성격이 같다 — 화면이 근거가 되어 판단이 일어난다.

## 2. Work Type
- [x] Bugfix (dead filter · 가짜 신호 · DOM 해킹) · [x] Design Consistency · [x] Web

## 3. Overview

**Success Criteria**
- [ ] 화면이 없는 사실을 말하지 않는다 (활동 중 · 마지막 활동 · 장기 미접속 0건)
- [ ] 탭 전환이 controlled state (DOM 해킹 0)
- [ ] 상세 CTA 2개 · 좌석 게이지가 실한도 기반
- [ ] 리스트 3열 그리드 · 빈 처리 항목 박스 미노출
- [ ] 역할 인라인 드롭다운 + 본인 행 disabled

**Out of Scope (⚠️ 절대 구현하지 말 것)**
- [ ] 모바일 (`조직관리 모바일 개선.dc.html` — md 미작성 트랙)
- [ ] lastActive 실추적 배선 (없는 것을 만드는 일 · 별도 트랙)
- [ ] `Organization.maxMembers` 컬럼에 값을 채우는 일 (DDL/백필 · 별도 승인)
- [ ] 조직 설정 탭 전면 개편

**Canonical Truth Boundary**
```
Source of Truth   Organization · OrganizationMember (DB) · PLAN_LIMITS(lib/plans.ts)
Derived           멤버 상태(활성/초대 대기) = 계정 파생 · 좌석 사용률 = members / PLAN_LIMITS
Snapshot/Preview  없음 — 이 화면은 preview 를 만들지 않는다
🛑 금지            UI state 가 좌석 한도·멤버 상태의 canonical 을 대신 들지 않는다
```

**UI Surface Plan** — [x] 기존 route 내 재배치만. 새 페이지 0.

## 4. Product Constraints

**Must Preserve** — same-canvas · 기존 route 구조 · invalidation 규율
**Must Not Introduce** — page-per-feature · dead button/no-op · **없는 사실의 표기** · em dash

## 5. Global Test Strategy

- 삭제 4건(가짜 신호 2 · dead filter · DOM 해킹) → **부정 단언 sentinel** (stripComments 본에)
- 배선 3건(controlled tabs · 좌석 실한도 · 딥링크) → 소스 계약 sentinel
- 역할 드롭다운 저장 → 기존 members PATCH 계약 재사용 여부 P0 에서 확인
- 🛑 삭제 sentinel 은 **검출력 실증** 필수 — 경계 안 주입 RED + 경계 밖 대조군 GREEN

---

## 7. Implementation Phases

### Phase 0: Truth & 인벤토리 lock
- Status: [x] **Complete** (2026-08-24)
- **🔴 RED** — C1·C2·C3 미해결 상태로는 P2 이후가 서지 않는다
- **🟢 GREEN** — 아래 5건 실측·판정 완료
```
1  좌석 한도 배선축 결정 — org API 응답 확장 vs 클라이언트 PLAN_LIMITS 참조
   (org API 응답에 plan 필드가 이미 있는지부터 실측)
2  탭 토큰 정본 판정 (C2) — analytics 2.5px vs quotes 2px
3  조직 설정 핸드오프 §3 확인 (C3) — 없으면 역할 드롭다운 토큰 재지정
4  삭제 4건의 **피의존** 전수 — 인벤토리 2축 중 "누가 그것에 기대나"
   (lastActive · 활동 중 Badge · inactive 필터 · querySelector 2곳을 누가 읽는가)
5  members PATCH 계약 — 역할 변경 엔드포인트가 이미 있는가
```
- **✋ Gate** — 미해결 충돌 0 · 추정 0 · 피의존 계수 주체 분리(로컬 세션 독립 계수) 권장
- **Rollback** — 계획 전용, 코드 변경 0

### Phase 1: Contract & Failing Tests
- Status: [x] **Complete** (2026-08-24 · P2 와 한 슬라이스 · 검출력은 주입 실증으로)
- **🔴 RED** — 삭제 4 + 배선 3 sentinel 을 먼저 RED 로
- **✋ Gate** — 검출력 실증 5/5(주입 4 + 대조군 1) · tsc 불변
- **Rollback** — 테스트 파일 revert

### Phase 2: 거짓 제거 (멤버 탭)
- Status: [x] **Complete** (2026-08-24)
- **가짜 활동 신호 삭제** — `lastActive`(:330) · "마지막 활동" 열(:1019) · "활동 중" Badge(:1074)
- **dead filter 삭제** — inactive 분기(:343) + 칩(:947~) · 필터 3개로
- **DOM 해킹 제거** — :596 · :691 → controlled Tabs `value`/`onValueChange`
- `관리자 N명` 요약 칩 제거
- **✋ Gate** — 부정 단언 GREEN · 화면에 없는 사실 표기 0 · 필터 각 칩이 실제 모집단을 센다
- **Rollback** — 이 phase 만 revert 가능 (삭제 중심 · 배선 의존 0)

### Phase 3: 상세 헤더 · KPI · 탭
- Status: [x] **Complete** (2026-08-24)
- CTA 2개(`＋ 멤버 초대` 주 · `권한 검토` 보조) · 초대 관리 → 탭 직행 링크 · 플랜/좌석 → KPI 흡수
- 헤더 메타(주소 + 생성일) · KPI 4카드(승인 권한 0 = 앰버 + `지정 필요`)
- 탭 밑줄형(P0 정본 토큰) · **좌석 게이지 = PLAN_LIMITS 실한도** (:549 추정 공식 교체)
- **✋ Gate** — 좌석 분모가 상수 추정이 아님을 sentinel 이 잠근다 · dead button 0
- **Rollback** — 헤더/KPI 블록 revert

### Phase 4: 개요 2열 + 멤버 탭 나머지 (→ P4a / P4b 로 분할)
- Status: [x] **P4a Complete** (2026-08-24) · [ ] P4b Pending
- 개요 2열(1fr + 380px) · 좌 처리 항목(결과 설명 + 액션) · 우 구성 요약 + 플랜 카드
- 정적 3카드 삭제 · 최근 활동 **빈 상태 정직 표기** + 활동 로그 딥링크
- 역할 인라인 드롭다운(본인 행 disabled + 캡션 · 저장 후 `✓ 저장됨` 1.5초)
- 초대 대기 행 재발송/취소 인라인 · 승인자 지정 → 멤버 탭 딥링크(드롭다운 오픈)
- **✋ Gate** — 저장 실패 시 롤백 표기 존재(placeholder success 0) · 본인 행 변경 불가 실증
- **Rollback** — 개요/멤버 탭 블록 revert

### Phase 5: 리스트 3열
- Status: [ ] Pending
- 3열 그리드 + `새 조직 만들기` dashed placeholder · 검색 행 우측 요약 1줄
- "바로 처리할 항목" **0건 미노출** · 우측 280px 컬럼 제거
- **✋ Gate** — 빈 상태·로딩·에러 3상태 존재 · 0건에서 배너 0
- **Rollback** — page.tsx revert (상세와 파일 분리 · 독립)

### Phase 6: 게이트 · 배포 · 프로덕션 실측
- Status: [ ] Pending
- 로컬 세션 게이트(스코프에 `__tests__/organizations` 포함) → push → 배포 확인
- 배포 확인 = `/api/health` manifestGeneratedAt > 커밋 시각
- 프로덕션 실측: 탭 전환 · 역할 변경 저장 · 초대 재발송 · 좌석 게이지 값
- **✋ Gate** — QA 6항목(핸드오프) 전량 실측 · 미완은 미완으로 보고
- **Rollback** — 커밋 단위 revert (phase 별 독립)

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| 좌석 한도를 dead column 에서 읽어 게이지가 조용히 거짓 | High | High | P0 C1 판정 + 분모 축 sentinel |
| 삭제 4건 중 피의존이 있어 다른 화면이 깨짐 | Med | Med | P0-4 피의존 전수(2축 인벤토리) |
| 탭 토큰이 세 번째로 갈림 | Med | Low | P0 C2 정본 판정 후 착수 |
| 1,885줄 파일 수술 중 TDZ/JSX 구조 사고 | Med | High | 소스 대조 프로브 + tsc 병행(구조는 컴파일러만 본다) |
| 역할 변경 API 부재 | Low | High | P0-5 에서 선확인 · 없으면 P4 분리 |

## 10. Rollback Strategy
phase 별 커밋 분리 · 마이그레이션 0 · feature flag 불필요(순수 UI/배선).
P2 는 삭제 중심이라 되돌리면 정확히 현행으로 복귀한다.

## 11. Progress Tracking
- 완료율 68% (P0~P3 · P4a 완료) · 현재 phase: P4b 대기 · 블로커: 없음

## 12. Notes & Learnings
- [2026-08-24] 착수 전 대조에서 C1 이 나왔다. 핸드오프 §5 가 "플랜별 실제 한도" 라고만 적어
  구현자가 `Organization.maxMembers` 로 갈 수 있었다 — 그 컬럼은 소비자 0 · 생산자 0 이다.
  오늘 세운 §reachability-needs-a-different-tool 이 착수 전에 한 번 값을 했다.


---

## P0 결과 (2026-08-24 · 전 항목 판정 완료 · 블로커 0)

### C1 — 좌석 한도 배선축 ✅ 확정

```
Organization.plan        생산자 ✅ billing/webhook:80·165·201   소비자 ✅ subscription:183 · billing:355
Organization.maxMembers  생산자 0 · 소비자 0 — dead. 건드리지 않는다(살리면 PLAN_LIMITS 와 두 진실)
결정                     /api/organizations 응답에 plan 1필드 확장
                         → 클라이언트가 PLAN_LIMITS[plan].maxMembers 를 분모로
교체 대상                [id]/page.tsx:549 Math.max(totalMembers + 2, 10)
```

### C2 — 탭 토큰 정본 ✅ analytics (호영님 판정)

```
정본   border-b-[2.5px] border-[#2563eb]   9042c438 · 2026-08-16 · 탭 밑줄형 전환이 명시 목적
별도   quotes rail 내부 소형 탭 2px          3cd0baa7 · 2026-06-23 · 성격이 달라 통일하지 않는다
```
🛑 정본 확정과 함께 **토큰 sentinel 을 세운다** — 지금은 선례 2건일 뿐 잠금이 없어 세 번째가 또 갈린다.

### C3 — 역할 드롭다운 토큰 ✅ 저장소 선례 (호영님 판정)

```
dashboard 범위   @/components/ui/select      14파일
                 @/components/ui/dropdown-menu  0파일
정본             shadcn <Select>  — §11.259c(native select CI block)의 대체 지정과도 일치
확인             organizations 파일에 Select 금지 sentinel 0 · [id]/page.tsx:22 가 이미 import 중
```
문서가 나오면 대조해 정정한다(이월 아님 · 진행 가능).

### P0-4 — 삭제 4건 피의존 ✅ **0건**

```
lastActive          이 파일 전용. 파일 밖 0 · 테스트 핀 0
"활동 중" Badge      파일 밖 0
memberStatusFilter  파일 밖 0
querySelector 2곳    핸들러 내부 전용
```
⚠️ 별개 축 1건 — `lib/review-queue/ops-hub-adapters.ts:78·85` 가 `lastActiveAt` 을 받는다.
이름이 비슷하나 **다른 어댑터**이고 조직 상세와 무관하다. 삭제해도 안 깨진다.
(그쪽 생산자 유무는 이 트랙 범위 밖 — 노트만 남긴다.)

⚠️ P2 착수 시 sweep 대상 (§sweep-widen-then-filter — 토막으로 넓게)
```
__tests__/api/organizations/org-member-patch-approval-limit.test.ts
__tests__/dashboard/organizations-detail-capability-edit.test.ts
__tests__/dashboard/settings-org-members-approval-limit-section.test.ts
```

### P0-5 — 역할 변경 API ✅ 있다. P4 분리 불필요

```
PATCH /api/organizations/[id]/members:77
  { memberId, role?, approvalLimit? }  partial update
  enforceAction 'member_role_change' (:96) · OWNER 직접 할당 불가 검증(:134)
  변경 0건이면 400 (:111)
```
인라인 드롭다운은 이 계약을 그대로 쓴다 — 새 엔드포인트 0.

### P0 에서 파생된 별건 (UI 트랙과 분리)

`docs/handoff/CARD_org-create-limit-always-free.md` — 조직 생성 한도가 모두에게 FREE.
좌석 한도를 재려던 grep 이 물어 올렸다. 단독 슬라이스 · 착수 순서만 조율.


---

## P1 sweep 결과 (§sweep-widen-then-filter · 2026-08-24)

교체/삭제 토큰을 먼저 정하고 `__tests__` 전역에 **토막으로 넓게** 걸었다.

```
lastActive        0건
활동 중            0건
장기 미접속        0건
memberStatusFilter 0건
"inactive"         0건
querySelector     10건 → 전부 무관 (quotes 키보드 내비 · admin 모달 · safety · button)
                        organizations 관련 0건
```

### ⚠️ 오탐 2건을 걸렀다 — 다시 조사하지 않는다

```
1  lib/review-queue/ops-hub-adapters.ts:78·85  `lastActiveAt`
   이름만 비슷한 별개 어댑터(members 인자 · 7일 기준 active 계산). 조직 상세와 무관.
2  P0 에서 "organizations" 파일명으로 잡은 3파일
   org-member-patch-approval-limit · organizations-detail-capability-edit ·
   settings-org-members-approval-limit-section
   🛑 **파일명으로 잡힌 것이지 토큰 핀이 아니었다.** 셋 다 위 토큰을 하나도 안 쓴다.
   P0 의 그 목록 자체가 오탐이었고 P1 실측이 정정했다.
```
🔑 오탐을 걸렀다는 **사실 자체**를 남긴다. 다음 세션이 같은 grep 을 돌리면 또 나오고,
걸렀다는 기록이 없으면 또 조사한다.

## P2 결과 (거짓 제거 · 13 슬롯)

```
A  controlled Tabs      activeTab state 신설 · <Tabs value/onValueChange>
B  DOM 해킹 제거         :596 · :691 → setActiveTab("invites") / ("members")
C  lastActive 소거       interface · 대입 · "마지막 활동" 헤더 · 셀  (4곳)
D  상태 배지             "활동 중" → "활성" (계정 파생만)
E  dead filter 소거      분기 · 칩 배열 · 라벨 · counts · 아이콘 · PauseCircle orphan import
```

### 🛑 경계 한정 — 세 번째 반복을 착수 중에 잡았다

`<Tabs defaultValue=` 를 **파일 전역** 부정 단언으로 걸었더니 무관한 탭 그룹
(:1647 초대 방식 email/link)이 잡혔다. 259c·4a 에 이은 세 번째가 될 뻔했다.
→ 옛 값 그 자체(`defaultValue="overview"`)만 금지하도록 좁혔고, 무관 탭 그룹이
그대로 남아 있음을 **경계 밖 대조군**으로 함께 단언한다.

### 실측이 문서를 정정한 것

핸드오프 §4(멤버 탭)가 "`관리자 N명` 요약 칩 제거" 를 적었는데, 실물은 :796
**개요 탭**의 "승인 체계" 카드 안에 있다. 그 카드는 P4 에서 구성 요약으로 흡수되므로
이 항목은 **P4 소관**이다. §4 에 적혀 있다고 P2 에서 지우면 개요 카드가 깨진다.

sentinel: `src/__tests__/dashboard/organizations-honest-member-tab.test.ts` (11건)


---

## P3 결과 (2026-08-24)

### 🛑 C1 자기 정정 — 응답 확장이 필요 없었다

```
P0 판정   "/api/organizations 응답에 plan 없음 → 응답 1필드 확장이 선행 조건"
실측 정정  organization 에 **select 가 없다** → Prisma 는 모든 스칼라를 반환한다. plan 포함.
증거      [id]/page.tsx:552 가 이미 (organization as any).plan 으로 planLabel 을 만든다
```
🔑 오류의 원인: `grep "select:|plan"` 로 select 절만 보고 "명시 select 없음 = 필드 없음" 으로
읽었다. Prisma 는 정반대다. **쿼리를 봤고 그 쿼리가 무엇을 반환하는지 안 셌다** —
§reachability-needs-a-different-tool 에 여섯 번째 줄로 붙는다:

```
쿼리   include 를 봤다   → 그 쿼리가 무엇을 반환하는지 안 셌다 (select 부재 = 전부 반환)
```
→ P3 범위가 줄었다. API 변경 0.

### 착수 슬롯

```
A  CTA 2개        초대 관리 삭제(→KPI 초대 대기 카드 탭 직행) · 플랜/좌석 보기 삭제(→KPI 4카드)
                  멤버 초대 = 주(bg-blue-600 채움) · 권한 검토 = 보조(outline)
B  헤더 메타       생성일만. 🛑 주소는 스키마에 필드 0 (slug 는 URL 식별자) — 호영님 판정
C  KPI 4카드      멤버 / 초대 대기(탭 직행) / 승인 권한(0=앰버+지정 필요) / 플랜·좌석(게이지+변경)
D  밑줄 탭        C2 정본 2.5px #2563eb · TabsList 를 border-b 컨테이너로
E  좌석 실한도     PLAN_LIMITS[plan].maxMembers (FREE 1 · TEAM 3 · ORGANIZATION 10)
                  🛑 옛 축 Math.max(totalMembers+2, 10) 은 멤버가 늘면 분모도 늘어
                     사용률이 영원히 100% 에 안 닿던 가짜 게이지였다
```

### ⚠️ 넓은 단언 3건 — 전부 착수 중에 잡았다

```
1  /<Tabs defaultValue=/        → :1647 초대 방식 탭이 걸림     (P2)
2  /초대 관리/                   → :1198 "승인 및 초대 관리" 제목이 걸림
3  variant="outline" 근접 200자  → 앵커 부족으로 매칭 실패 (거짓 RED)
```
1·2 는 **지운 것과 이름이 겹치는 살아 있는 표면**을 잡는 형태다. 셋 다 경계를 좁히고,
1·2 는 그 표면이 살아 있음을 **경계 밖 대조군**으로 함께 단언했다.
🔑 창을 좁혔다는 것만으로는 "무관 표면을 안 잡는다" 가 증명되지 않는다.

sentinel: `src/__tests__/dashboard/organizations-header-kpi-tabs-p3.test.ts` (16건)


---

## P4 분할 · P4a 결과 (2026-08-24)

phase 가 4시간을 넘길 크기라 둘로 쪼갰다 (phase sizing 규율).

```
P4a  개요 2열 재구성                       ✅ 완료
P4b  멤버 탭 나머지 — 역할 인라인 드롭다운 · 초대 대기 행 인라인 액션 ·
     승인자 지정 딥링크의 "드롭다운 오픈 상태" 까지                    ⏳ 대기
```

### P4a 슬롯

```
좌  바로 처리할 항목    label + **consequence**(결과) + count + 액션 버튼
                       "승인자 미지정" → "구매 요청이 승인 단계 없이 통과됩니다" + [승인자 지정]
    최근 활동          §11.318 honesty 승계 — 가짜 피드 0 · "아직 기록된 활동이 없습니다"
                       + 전체 활동 로그 딥링크
우  구성 요약(380px)   멤버 / 초대 대기 / 승인자 3행 — 기존 정적 3카드 흡수
```

### 실측이 문서를 정정한 것 — 2건째

```
1  핸드오프 §4 "관리자 N명 칩 제거"  → 실물은 개요 탭 "승인 체계" 카드 안 (P2 에서 확인)
                                      정적 3카드 삭제로 P4a 에서 함께 소멸
2  핸드오프 §3 "우: 구성 요약 + 플랜 카드"
   🛑 플랜 카드를 개요에 두지 않았다. P3 에서 KPI 4번째 카드가 이미 흡수했다.
      다시 두면 §2 가 "플랜/좌석 보기" 를 지운 이유(화면 내 정보 중복)를 재생산한다.
      §3 은 KPI 4카드가 서기 전 기준으로 쓰인 것으로 보인다.
```

### 명명 정정 — "경계 밖 대조군" 을 잘못 붙였다 (로컬 세션 지적)

```
프로브의 경계 밖 대조군   아무 단언도 닿지 않는 지점. 건드려도 GREEN 이어야 한다.
이름 겹침 표면 생존 단언  지운 것과 이름이 겹치는 살아 있는 표면을 **긍정으로 잠근다**.
                          🛑 단언을 건 순간 그 표면은 경계 **안**이다 — 대조군이 될 수 없다.
```
P2·P3 sentinel 의 해당 단언 이름을 정정했다. 잘못된 이름이 로컬 세션의 프로브 설계를
실제로 오도했다(대조군 A 오설계) — §step-name-lies 가 테스트 이름에서 난 사례다.

⚠️ 그리고 P4a 착수 중 **내 프로브가 또 틀렸다** — `TabsContent` 개수를 6으로 짐작했으나
실제 7개(메인 5 + 초대 다이얼로그 2)였고 열림/닫힘 7/7 균형이었다. 코드가 아니라 프로브가
틀린 것이고, 로컬 세션이 같은 턴에 고치겠다고 한 형태를 그대로 반복했다.
🔑 **앵커는 짐작하지 않고 먼저 센다.**

sentinel: `src/__tests__/dashboard/organizations-overview-two-column-p4a.test.ts` (11건)
