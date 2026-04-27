# LabAxis Product Direction Brief — 2026-04-27

**작성:** 호영님 (운영 총괄) 요청 — P1 6/6 close + 3-issue UX track close + reports/budget surface fix 직후 product 방향 정리
**기준 시각:** 2026-04-27 (KST 22:54)
**최근 ADR 상태:** §11.43 까지 closed, working tree clean, origin/main 동기화 완료
**Vercel 배포 상태:** dpl_5xMMkDU5b9LBUmeobbF2nW7NDDZY READY (build 1m 45s, 0 errors)

---

## I. 지금까지 닫은 트랙 — Surface Stabilization 단계

지난 ~2주 동안 §11.18 → §11.43 까지 26개 §11.x 트랙이 closed. 이를 4개 카테고리로 묶으면 LabAxis 운영 surface가 "**기능 추가**"가 아니라 "**원칙 위반 회수**" 단계에 있었음:

| 카테고리 | 트랙 | 핵심 |
|---|---|---|
| **A. 보안 / 권한** | §11.27 (#SEC04 action rename), §11.28-35 (csrf-fetch-sweep 17/17), §11.36 (test-only @ts-nocheck 0건) | enforceAction 일관성 + CSRF 커버리지 + 타입 신뢰 |
| **B. 인프라 / 마이그레이션** | §11.11-13 (vercel-migrate 정리), §11.20 (pilot vendor catalog), §11.26 (Anthropic migration), §11.37 (enum drift + MutationAuditEvent 확정 DONE) | 빌드/DB/AI provider 안정화 |
| **C. 운영 ontology** | §11.16, §11.21, §11.22 (conversion-queue 5-status, α-D bulk-PO), §11.30-32 (csrfFetch billing/quote/inventory) | 견적→발주→재고 핸드오프 |
| **D. UI/UX 원칙 회복** | §11.07 dead inventory cleanup / §11.38 RFQ handoff dead-code / §11.39 page-per-feature redirect / §11.40 raw enum 매핑 / §11.41 empty state UX / §11.42 reports contract drift / §11.43 budget detail dark surface | dead button / no-op / page-per-feature / canonical truth 위반 회수 |

**핵심 인사이트:** §11.18 이후 진행된 트랙의 **70% 이상이 "기존 코드 수정" 형태**였고, **신규 기능 추가는 거의 없음** (α-D bulk-PO 정도). 이는 production pilot data 진입 전 `surface trust` 를 확보하는 단계가 자연스럽게 길어졌음을 의미.

---

## II. 방금 새로 surface된 cleanup 후보

§11.43 작업 직후 호영님이 prod에서 직접 발견:

### #budget-detail-double-chrome (P2 — 다음 세션 1순위 cleanup)
- 위치: `apps/web/src/app/dashboard/budget/[id]/page.tsx:189-205`
- 증상: 페이지 안에 자체 LabAxis 로고 + `예산 통제` breadcrumb strip 을 그려서 `DashboardShell` (sidebar + DashboardHeader) 위에 chrome이 **이중**으로 나타남
- 비교: `/dashboard/reports/page.tsx:301-305`는 단순 `<h2>구매 리포트</h2> + <p>설명</p>` 으로 LabAxis 원칙 준수
- 원인: detail 페이지가 standalone screen 으로 디자인된 흔적 (다크 테마 시절). §11.43 fix 가 다크 surface 를 라이트로 바꾸면서 chrome 톤이 sidebar 와 같아져 **이중 표시가 비로소 가시화**됨
- 영향 범위: budget detail 단일 페이지, ~17 라인 삭제 + content 영역으로 이동
- 예상 작업: 1 commit (§11.44), <10 minutes

### 잠재 회귀 가드 후보
- ~~**#labaxis-no-inline-hex-bg**~~ → **§11.45 CLOSED** (2026-04-27): `scripts/check-no-inline-hex-bg.sh` 추가됨. **즉시 6 violation 발견** (`apps/web/src/app/dashboard/inventory/inventory-content.tsx` L2238/2254/2260/2282/2307/3698). `dashboard/page.tsx:427` 1 violation은 §11.45 commit에서 동시 정리. inventory 6 sites는 별도 §11.48 sweep 트랙으로 분리 (단순 sed 불가, 다크 카드 + 동적 hex `card.color/borderColor` + `style={{ color: ... }}` 텍스트 hex까지 박혀 있어 surface 재설계 수반).
- ~~**#reports-contract-test**~~ → **§11.46 CLOSED** (2026-04-27): `apps/web/src/__tests__/api/reports/purchase.contract.test.ts` 추가, 4/4 PASS. ESM-native vi.mocked 패턴.
- ~~**#budget-detail-screen-self-chrome-audit**~~ → **§11.47 CLOSED** (2026-04-27): 4 grep 패턴 audit, **0 active violations** outside §11.44. Pattern B 회귀 가드를 §11.45 스크립트에 통합 — 단일 "Surface Regression Guard"로 운영.

### Track A 완료 후 다음 세션 진입 옵션 (우선순위 순)
1. **§11.48 #dashboard-inventory-dark-hex-sweep** (P2) — inventory-content.tsx 6 sites 다크 hex 정리. ui-wizard skill 권장. 1시간 예상. closing 시 `check-no-inline-hex-bg.sh` exit 0 도달 → §11.49 micro-track으로 CI hook.
2. **#α-F-followup-api-contract-tests** — §11.46 패턴을 다른 dashboard 소비 API 4개(`/api/budgets`, `/api/quotes/my`, `/api/work-queue/purchase-conversion`, `/api/inventory`)에 일반화. 30분-1시간.
3. **운영자 product gap discovery** — Track B (호영님 직접 운영 후 발견하는 항목).

### 새로 surface된 트랙

- **§11.48 #dashboard-inventory-dark-hex-sweep** (P2) — `dashboard/inventory/inventory-content.tsx` 6 inline-hex sites 정리. 다크 테마 (`#1E2738`, `#151C26`, `#1a1f2e`, `#2E3B50`) 잔재가 LabAxis 라이트 chrome 안에 박혀 있음. `card.color`/`borderColor` 같은 동적 hex 처리 필요 — 단순 토큰 교체가 아니라 chart palette / status badge 색을 LabAxis token으로 표준화하는 작업. 예상 작업량: 2-3 commit, ~1시간. ui-wizard skill 사용 권장.

---

## III. 6-month-deferred 전략 옵션 — §11.29 결정 다시 보기

§11.29 에서 "6-month deferred" 로 미뤘던 4개 큰 옵션. 지금 시점(P1 6/6 close + surface trust 확보 직후)에서 다시 평가:

### Option 1. 운영 데이터 모니터링 트랙
- 내용: pilot tenant 의 PurchaseRecord / Quote / Order 흐름을 시간 축으로 본다, anomaly detection, ops dashboard.
- **현재 평가:** signal-to-noise 낮음. pilot 1개 + PurchaseRecord 3건 + Quote 소수 → 통계가 의미 없음. **6개월 더 미뤄야 함.** 단, §11.43 같은 "운영자가 직접 발견" 패턴을 줄이려면 현재 Vercel/Sentry 같은 에러 모니터링은 별도로 검토 가능 (작은 트랙).

### Option 2. New AI-action types (write actions 확장)
- 내용: 현재 read-only / soft-confirm 형태인 AI action 을 발주 자동 제출, 재고 자동 차감 같은 mutate action 까지 확장.
- **현재 평가:** §11.27 (SEC04) 에서 enforceAction 일관성 확보했고, AI provider 도 Anthropic 통일(§11.26) 완료. **기술 준비도는 충분.** 단 운영자 신뢰가 핵심 — pilot 에서 수개월의 read-only 운영 + 검증된 패턴 후에 진입해야 함. 지금은 시기 상조.

### Option 3. Batch operations (대량 처리)
- 내용: 견적 일괄 발송, 발주 일괄 확정, 입고 일괄 처리 등.
- **현재 평가:** α-D bulk-PO (§11.21) 가 발주 쪽 batch 의 첫 단추. 현재 데이터 규모 (Quote 한 자릿수, PurchaseRecord 한 자릿수) 에서는 batch 가 의미 없음. **데이터 규모가 한 자릿수 → 두 자릿수 후반 갈 때 진입.** 지금은 X.

### Option 4. Billing UX option D (자체 결제 흐름 + workspace billing)
- 내용: Stripe portal 의존을 줄이고 LabAxis 내부 billing surface 강화.
- **현재 평가:** §11.30 (#α-F billing csrfFetch) 으로 보안은 정리됐지만 UX 자체는 Stripe portal 으로 외부 위임 중. pilot 단계 (1 tenant, 결제 빈도 매우 낮음) 에서는 자체 UX 투자 ROI 낮음. **6개월 더 deferred 합리적.**

### IV. 정리

| Option | 6mo deferred 유지? | 진입 트리거 |
|---|---|---|
| 1. 모니터링 | ✅ 유지 (단, 외부 에러 모니터링은 별도) | pilot tenant 5개 이상 또는 PurchaseRecord 50건 이상 |
| 2. AI write actions | ✅ 유지 | pilot 운영자가 read-only AI 결과를 6개월 이상 신뢰 + 0 incident |
| 3. Batch ops | ✅ 유지 | Quote/Order 월 수십 건 단위 → 한 자릿수 운영자가 명시적 요청 |
| 4. Billing UX D | ✅ 유지 | tenant 5개 이상 + 다양한 결제 패턴 발견 |

→ **4개 모두 6개월 더 deferred 가 합리적.** 운영 신호가 부족함. 이 결정 자체가 §11.29 의 재확인.

---

## IV. 그러면 다음 트랙은?

§11.x 26개 closed + Option 1-4 모두 deferred → **다음 트랙은 surface cleanup 마무리 + product gap 식별**:

### Track A — Surface Cleanup 마무리 (단기, 1-2 세션)
- §11.44 #budget-detail-double-chrome (위 II 참조)
- §11.45 #labaxis-no-inline-hex-bg CI 룰 추가
- §11.46 #reports-contract-test snapshot 1건 추가
- §11.47 #budget-detail-screen-self-chrome-audit (다른 surface 에서 같은 패턴 있는지 grep)
- 합계: 4 commit, ~30분-1시간

### Track B — Product Gap Identification (중기, 호영님 직접 운영 후)
호영님이 prod 에서 실제로 견적-발주-입고 운영을 1주일 단위로 돌리면서 surface 한계점을 직접 surface 하는 단계. 이때 발견되는 항목이 진짜 다음 트랙의 트리거가 됨. §11.43 / §11.42 처럼 "실제 데이터로 굴려보니 보임" 가 유일한 가시화 방법.

### Track C — Pilot Data 풍부화
PurchaseRecord 3건 → 30건, Quote 한 자릿수 → 두 자릿수, vendor 15개 → 50개 늘리는 데이터 작업. seed-script 확장 또는 호영님이 실제 견적 받아 입력하는 운영. 이 작업 후 Option 1-4 의 진입 트리거가 자연스럽게 발현.

---

## V. 권장 다음 액션

호영님 결정 옵션 (우선순위 명확):

**A. 즉시 break — 이번 세션 종료, 다음 세션에서 Track A (surface cleanup 마무리) 진입.**
- 근거: 오늘 P1 6/6 close + 3-issue UX track close + reports/budget surface fix + chrome 이중 표시 발견까지 한 세션에 누적. 다음 세션 1번째 작업으로 §11.44 가 자연스러움.

**B. 이번 세션 안에서 §11.44 (#budget-detail-double-chrome) 까지 처리 후 break.**
- 근거: 작은 cleanup (10분, ~17줄 삭제), §11.43 의 자연스러운 follow-up. 호영님 머릿속에 chrome 이슈가 있을 때 같이 마무리하면 컨텍스트 손실 없음.

**C. Track A 4 commit 모두 이번 세션에서 처리.**
- 근거: 1시간 정도. 다만 vitest 추가 + grep CI 룰까지 들어가면 검증 비용 증가. 권장도 낮음 (피로 누적 위험).

**A 또는 B 권장.**

---

## Appendix — 통계 요약

```
누적 §11.x entries closed: 26 (§11.18 → §11.43)
누적 commit (이번 세션): 5 (b16c5c8f, e1faa802, 02c80ad6, 0b823f29, 719c0d42)
누적 LOC delta (이번 세션): +57 / -213 (net -156, dead code 정리 우세)
미해결 P1: 0 (6/6 closed)
미해결 P2: 1 (#budget-detail-double-chrome — 위 II)
미해결 P3: 다수 (Track A 후보 3개 + Vercel 환경 정리 작은 항목들)
6mo-deferred 트랙: 4 (Option 1-4 모두 유지)
```

---

**작성자:** 운영 총괄 보조 (Claude, opus 4.7)
**다음 세션 프리트리거:** "Track A 진입" 또는 "이번 세션 §11.44 까지" 또는 "다음 세션에 product gap 으로 시작"
