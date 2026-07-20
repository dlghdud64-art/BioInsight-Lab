# 세션 인수인계 — 2026-07-20 (메인 대시보드 모바일 개선 §dashboard-mobile-refine)

## 0. 즉시 재개 지점 (다음 세션 첫 작업)

- **본 트랙 종결.** `PLAN_dashboard-mobile-refine.md` ✅ Complete. 미결 0, origin/main 격차 0.
- 다음 세션 후보:
  1. **2a-6 내비 뱃지** — 본 세션 defer 분(§3 Backlog #1). 착수 전 승인 필요
  2. `mobile-density` PLAN 정리 — 3 phase 전부 Complete인데 헤더가 `In Progress`로 stale (§4)
  3. 이전 backlog(§4 full 경고통합·§5 D+배지/개별발송/활동로그) · 규제/GMP 미결(DMSO H227·SM-P4d·안전 e2e)
- 워킹트리 잔존: `PLAN_quotes-mobile-density.md`(untracked, 이전 세션 이월) + 기존 noise M. **전부 add-list 밖·미접촉.**

---

## 1. 배포 완료 (2커밋, 전부 origin/main)

### §dashboard-mobile-refine P2·P3 — `fbe91723`
| 항목 | 내용 |
| :--- | :--- |
| 1a 재고 카드 톤다운 | 배경 채색(`bg-rose-50/border-rose-200`) 폐지 → 흰 카드. 레드는 22px 아이콘 칩·라벨·숫자만. 0건은 칩까지 회색 비활성(§11.311 #4) |
| 1a 배너 2줄 | `line-clamp-2 sm:line-clamp-none sm:truncate [text-wrap:pretty]` — **모바일만 2줄**, `sm↑`는 thin 1행 유지 |
| 2a-1 실행 큐 헤더 | `ActionInbox` 옵셔널 `viewAllHref` prop → 모바일만 `/dashboard/inbox` 주입. 데스크탑 `page.tsx` 무접촉, 미주입 시 미렌더(dead button 0) |
| 2a-2 지출+예산 통합 | inline SVG 스파크라인(`monthlySpending` 파생, 신규 fetch·패키지 0, **표본 2점 미만 미렌더**) + 예산 인라인 바. 별도 힌트 카드 폐지(카드 1개 감소) |
| 2a-3 역할 분리 | 재고 카드 = 순수 카운트 + `처리 ›`. 실행 큐 재고 행과 **이미 동일 목적지**(`?filter=low`)라 목적지 변경 0 |

부수: **F4 rose→red 정합** — `mobile-dashboard-view`는 `rose-*` 8회/`red-*` 0회로 CLAUDE.md §9 위험 토큰과
어긋나 있었음. 재고 카드 한정 정합. **전월 대비 증가 `text-rose-600`은 의미가 달라 범위 밖 미변경**(sentinel로 고정).

### §dashboard-mobile-refine P4 — `946bc8ef`
- **dismiss 단건화(F7=c)**: `deriveInsight` 단일 return → `deriveInsightCandidates`(우선순위 배열) +
  `.find(c => !dismissed.includes(c.id))`. insight별 안정 id(`budget-unset`/`budget-over`/`stock-short`/`quote-open`/`ok`).
  저장 키 `lab_insight_dismissed_v2`(JSON 배열), 레거시 `"1"` **미승계**.
- **고친 결함**: ✕ 1회로 이후 **모든** 운영 신호가 영구 차단되던 구조 → 닫은 신호만 스킵, 전부 닫혀야 배너 숨김.
- **정직 부수효과**: 레거시 영구-dismiss 사용자는 배너 **1회 재노출**(의도됨).

---

## 2. 확정 결정 (재론 불요)

| ID | 결정 | 근거 |
| :--- | :--- | :--- |
| **#2 amber** | **C — yellow 계열 근사** | 지시문 amber 헥스는 *디자인 의도* 표기이지 토큰 지정 아님. 16 amber-removed sentinel + CLAUDE.md §9 해제는 비용-편익 역전 |
| **색상 표기 규약** | 핸드오프의 **앰버/오렌지 표기 = "warm warning(yellow 토큰)"** 으로 읽는다 | 호영님 2026-07-20. 이후 전 핸드오프 적용 |
| **F5** | **(i) 수용** — 모바일 배너 밀도 차 허용 | 대시보드=단일 배너/전체 맥락, 견적=리스트 즉시 노출. 역할 상이. 데스크탑 parity는 `sm:truncate`로 계속 잠금 |
| **F7** | **(c) 절충** — dismiss 단건화만 | 온보딩 3단계는 canonical 파생 가능하나(데이터 문제 아님), §dashboard-shifan-adopt P2 (C) hero 폐지 결정 존중. 진행 점은 sentinel로 **도입 금지 고정** |
| **F8** | **(a) defer** → backlog | `OpsStoreProvider`가 `seed-data.ts` 고정 seed로 초기화 → 그대로 쓰면 **가짜 카운트**(재고 0건에도 뱃지) |
| **F11** | **2a-5 FAB 미구현 확정** | 지시문 *메커니즘*(46px 원형)이 지시문 *목표*(터치 타겟 안 가림)와 상충. 현행 §11.272e가 목표를 더 강하게 달성. **향후 FAB 축소안 재등장 시 이 판정 우선** |

**지시문 8항목 최종: 이행 6 · 미구현 1(F11, 근거 있는 반려) · defer 1(F8).**

---

## 3. Backlog (별도 신중배치, 착수 전 승인)

1. **2a-6 내비 뱃지** (본 세션 defer)
   - 문제: `bottom-nav.tsx`는 완전 presentational, canonical summary 접근 경로 없음.
     `dashboard-shell.tsx` L26이 `OpsStoreProvider`를 "bottom-nav badge 카운트 전용"으로 지목하나
     **실측 결과 `seed-data.ts` 고정 seed**(`ALL_STOCK_POSITIONS = [STOCK_POSITION_001, STOCK_POSITION_002]`).
   - 정공법 = **(b) shell 레벨 canonical provider 신설**(summary 훅 승격). 구조 변경이라 별도 계획서 필요.
   - ⚠️ 부수 이슈: `BottomNav`는 `lg:hidden`(<1024), 모바일 대시보드는 `md:hidden`(<768) →
     **768~1024 구간에서 데스크탑 대시보드와 뱃지가 동시 노출**. 설계 시 반드시 반영.
   - ❌ 금지: ops-store seed 경유(가짜 카운트) · BottomNav 내부 신규 fetch(전 라우트 overfetch)
2. (이월) §4 full 경고통합 · §5 D+배지/개별발송/활동로그
3. (이월) 규제·GMP 미결 — DMSO H227 · SM-P4d · 안전 e2e

---

## 4. 워킹트리 의도적 잔존 (혼입 금지)

- `PLAN_quotes-mobile-density.md` — untracked. **본문 3 phase 전부 ✅ Complete + "트랙 완료" 명시**인데
  헤더만 `🔄 In Progress`로 **stale**. surface가 견적이라 본 트랙과 파일 중복 0 → 흡수 불필요.
  → 다음 세션에서 operator 게이트 확인 후 **원 맥락에서 종결 처리 권장**. 임의 커밋/삭제 금지.
- `ai-insight-dialog.tsx` — **0 diff noise**(git diff 빈 결과, §마커 없음). 2회 커밋 모두에서 제외 확인.
- 기타 기존 noise M — 세션 이전부터 존재. 원 맥락에서 별도 판단.

---

## 5. 세션 학습 (강제 규칙화)

### F9 — 🔴 sandbox 검증 하네스 결함 (operator 실측이 적발)
- **사고**: sandbox가 "13/13 GREEN" 보고 → operator full vitest에서 **신규 실패 1건**.
  `dashboard-mobile-refine-p2`가 `<ActionInbox items={actionInboxItems} />`(self-closing)를 pin했는데
  sandbox 자신이 Phase 3에서 `viewAllHref`를 주입 → **자기 변경과 자기 sentinel 충돌**.
- **근본 원인**: node 하네스가 sentinel 정규식을 **다시 타이핑(전사)**했다. Phase 3 검증 때 `/<ActionInbox/`(느슨)로
  옮겨 적어 실제 파일의 엄격한 pin을 검사하지 못함.
- **교체**: 하네스를 **테스트 파일에서 정규식을 추출해 원문 실행**하는 방식으로 전환.
  문자열 상수·`read()` 바인딩을 해석하고, **해석 불가한 복합 표현식은 SKIP으로 명시 카운트**해 은폐하지 않는다.
- **규칙**: ⛔ sandbox는 "assertion을 옮겨 적어" 검증했다고 보고하지 않는다.
  원문 실행 결과 + 미해석 건수를 함께 보고한다. **operator full `vitest`가 최종 판정.**

### F10 — `vitest` 통과 ≠ 빌드 안전
- full `vitest`는 **esbuild** 기반이라 **tsc strict를 검증하지 않는다.**
- ⛔ **`.tsx` 소스가 바뀐 배치는 커밋 전 `npm run build`를 별도로 반드시 실행.** (본 트랙 2회 모두 EXIT 0)

### 지시문 vs 코드 충돌은 "메커니즘"과 "목표"를 분리해서 볼 것
- F11이 대표 사례: 지시문의 **목표**(터치 타겟 안 가림)는 정당했지만 **메커니즘**(46px 원형 축소)이
  그 목표에 역행했고, 현행 코드가 이미 목표를 초과 달성 중이었다.
- ⛔ 지시문을 문자 그대로 구현하기 전에 **목표가 이미 충족되어 있지 않은지** 먼저 확인한다.

### sentinel 진화는 "보호의도 불변"을 명시할 것
- 본 트랙에서 3회 진화(density `truncate`→뷰포트 분기 / P2 서브텍스트→`처리 ›` / P2 ActionInbox pin 완화).
- 매번 **무엇을 계속 보호하는지**를 주석에 남기고, 회귀 금지 어서션을 오히려 추가했다.

---

## 6. 게이트 프로토콜 (불변)

1. sandbox: 계획 → 승인 → RED sentinel → 구현 → **하네스 원문 실행**
2. operator: 브랜치·워킹트리 확인 → **`npm run build`(.tsx 변경 시 필수)** → full `vitest` baseline-delta 0
3. operator: 단독 add(파일 명시) → commit → push. **noise 혼입 0 확인**
4. 호영님: 제품 결정(F5/F7/F8/F11류)은 sandbox가 근거 제시 후 **판정 대기**. 임의 진행 금지

**baseline**: `132 file fail / 293 test fail` (`946bc8ef` 시점). 직전 `133/294`(`fbe91723`) 대비 감소.
