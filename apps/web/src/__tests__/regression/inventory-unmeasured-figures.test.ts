/**
 * §inventory-unmeasured-figures · 재고 맥락 패널은 측정하지 않은 수를 그리지 않는다 (호영님 판정 2026-09-26)
 *
 * 무엇이 문제였나
 *   `inventory-context-panel.tsx` 가 두 가지 수를 그렸고 둘 다 출처가 없었다.
 *     ① 「미개봉 {수량×0.3}ea」  — 개봉/미개봉을 담는 축이 **스키마에 없다.**
 *        prod information_schema 조회: `ProductInventory` 에 open/seal/container 계열 컬럼 0.
 *        0.3 은 근거 없는 계수였다.
 *     ② 「최근 14일 사용속도 기준 N일 내 소진 예상」 — 그 **14일 창이 코드 어디에도 없다.**
 *        저장 필드 `ProductInventory.averageDailyUsage` 에 대입하는 코드 0곳(쓰기 지점 15파일 전수) ·
 *        유일한 파생(/api/inventory/reorder-recommendations)은 **마지막 기록 이후 경과일**로 나눈다.
 *
 * prod 실측 (2026-09-26 17:50 KST · operator-shell Windows → Supabase xhid… Transaction Pooler 6543 · SELECT 만)
 *   ProductInventory 13행 · averageDailyUsage 채워진 행 0 · leadTimeDays 채워진 행 0
 *   InventoryUsage 17행(2026-03-20~06-13) · 최근 14일 0행 · 개봉/미개봉 컬럼 0
 *   → 그 섹션은 실데이터로 렌더된 적이 없다. 값이 들어오는 유일한 경로는 파일럿 고정행이었다.
 *
 * 호영님 판정: 「만든 곳이 없는 숫자이니 숨깁니다. 추정치라고 라벨을 붙여서 남기지 마십시오.」
 *   → 리스크 분기 · 액션 분기 · 「소진 예측 근거」 섹션을 지웠다. 라벨을 바꿔 남기지 않았다.
 *
 * 무엇이 남았나 (이 검사가 함께 단언한다 — 삭제가 기능을 지우지 않았음을 증명한다)
 *   · 재주문 신호: 안전재고 축(`below_safety`) + canonical `reorderQty` prop
 *   · 폐기 우선: `isExpiredLotWithQty` 가 reorder 를 빼는 구조(§expired-lot-disposal-card-flow)
 *   · `averageDailyUsage?: number` prop 타입은 보존 — 측정 경로가 생기면 그 자리로 되살린다.
 *
 * 이 검사가 안 보는 것 (자기 한계 · 다음 검사의 시작점)
 *   1. `item.leadTimeDays ?? 14` — prod 에서 leadTimeDays 는 **채워진 행 0** 이므로 실제로는 늘 14 다.
 *      살아남은 소진 예상의 「긴급」 붉은 톤(1210행 `urgent`)이 그 기본값으로 갈린다. 수를 **표시**하지는
 *      않으므로 이번 판정(「만든 곳이 없는 숫자를 숨긴다」) 범위 밖으로 두었으나, 「리드타임 14일」 이라는
 *      가정이 색으로 새어 나오는 형태다 — 별건 판정 대상.
 *   2. `priority-action-queue.tsx` 의 `generateMockQueueItems` 폴백(부모가 항상 items 를 전달해 도달 0).
 *      §inventory-fabricated-figures 목록 1번의 마지막 항목이고 아직 열려 있다.
 *   3. 런타임 값이 아니라 소스 형태만 본다.
 *
 * 출처: §inventory-fabricated-figures 의 자기 한계 목록 1번. **두 번째로 그 목록이 정답을 들고 있었다**
 *   (첫 번째는 import-staging-workbench → §inventory-import-fake-success).
 *   §sentinel 자기 한계는 다음 검사의 시작점.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
/** 🛑 부정 단언은 주석 제거본에 건다 — 삭제 근거를 적은 주석이 그 자신의 단언에 걸리지 않게. */
const code = (rel: string) => stripComments(read(rel));

const PANEL_REL = "components/inventory/inventory-context-panel.tsx";
const PANEL = code(PANEL_REL);
const PANEL_RAW = read(PANEL_REL);

describe("§inventory-unmeasured-figures · 측정하지 않은 수 0", () => {
  it("측정 대상이 실제로 그 파일이다 · 빈 문자열을 통과로 세지 않는다", () => {
    expect(PANEL.length).toBeGreaterThan(30000);
    expect(PANEL).toMatch(/function InventoryContextPanel|export function InventoryContextPanel/);
  });

  it("① 「미개봉」 표기와 ×0.3 계수가 없다", () => {
    expect(PANEL).not.toMatch(/미개봉/);
    /* 계수 자체를 문다 — 수량에 상수를 곱해 없는 축을 만들어내는 형태. */
    expect(PANEL).not.toMatch(/currentQuantity\s*\*\s*0\.\d/);
  });

  it("② 「최근 14일」 이라는 측정 창 주장이 없다", () => {
    expect(PANEL).not.toMatch(/최근 14일/);
    /* 지운 섹션의 라벨 — 라벨만 바꿔 되살리는 경로도 막는다. */
    expect(PANEL).not.toMatch(/소진 예측 근거/);
    expect(PANEL).not.toMatch(/사용 속도 기준/);
    /* 🛑 「소진 예상」 을 통째로 금지하지 않는다. 판별기가 조항보다 넓으면 멀쩡한 구현이 RED 가 된다 —
     *    실측: 1221행 「{depletionDate} 소진 예상」 은 canonical usage 레코드 파생이고 0-상태가 있다.
     *    아래 describe 가 그쪽을 **양성으로** 잠근다. 금지 대상은 averageDailyUsage 축이다. */
  });

  it("③ 생산자가 0인 필드를 화면 수치로 쓰지 않는다", () => {
    /* averageDailyUsage 를 **읽는** 코드가 0 이어야 한다. prop 타입 선언 1줄은 남긴다(복원 자리). */
    const reads = PANEL.match(/item\.averageDailyUsage/g) ?? [];
    expect(reads).toEqual([]);
    expect(PANEL).not.toMatch(/일평균 사용량/);
    /* 복원 자리는 보존한다 — 타입이 사라지면 되살릴 때 계약을 다시 만들어야 한다. */
    expect(PANEL_RAW).toMatch(/averageDailyUsage\?: number;/);
  });
});

describe("§inventory-unmeasured-figures · 삭제가 기능을 지우지 않았다", () => {
  it("재주문 신호는 안전재고 축과 canonical reorderQty 가 든다", () => {
    expect(PANEL).toMatch(/type: "below_safety"/);
    expect(PANEL).toMatch(/item\.safetyStock !== null && item\.currentQuantity <= item\.safetyStock/);
    /* 경계를 붙인다 — 이름이 아니라 **사용 지점**을 문다(§sentinel-identifier-boundary 래칫). */
    expect(PANEL).toMatch(/\breorderQty\b[\s\S]{0,40}item\.unit|\{reorderQty\}/);
  });

  it("폐기 우선 구조가 그대로다 (만료 로트면 reorder 를 뺀다)", () => {
    expect(PANEL).toMatch(/const visibleActions = isExpiredLotWithQty/);
    expect(PANEL).toMatch(/actions\.filter\(\(action\) => action\.type !== "reorder"\)/);
  });

  it("🔑 살아남은 소진 예상은 canonical usage 레코드 파생이고 0-상태가 있다", () => {
    /* 지운 것과 남긴 것의 차이가 이 트랙의 요지다 — 측정된 수는 남고, 만든 수는 사라진다.
     * 이 단언이 없으면 다음 사람이 「소진 예상은 지웠어야 하는 것」 으로 읽고 이쪽까지 지운다. */
    /* 🛑 `usageTrend.trend.totalUsage` 만 물면 **표시 줄**(「총 N {unit}」)이 대신 매칭해 통과한다
     *    (프로브 실측 1건 · §4원칙 ④ 대체 매칭). 파생식을 **한 단위로** 문다. */
    expect(PANEL).toMatch(/const weeklyAvg = weeksSpan > 0 \? usageTrend\.trend\.totalUsage \/ weeksSpan : 0;/);
    expect(PANEL).toMatch(/daysLeft = weeklyAvg > 0 \? item\.currentQuantity \/ \(weeklyAvg \/ 7\) : null/);
    expect(PANEL).toMatch(/소진 기록이 없습니다\./);
    expect(PANEL).toMatch(/inventory-context-usage-trend-empty/);
    /* 예측은 daysLeft 가 있을 때만 그린다(가짜 예측 금지). */
    expect(PANEL).toMatch(/\{depletionDate && \(/);
  });

  it("폐기 액션 문구는 만료일·lot 만 말한다 (없는 축을 끼워 넣지 않는다)", () => {
    const i = PANEL.indexOf('type: "dispose"');
    expect(i).toBeGreaterThan(0);
    const block = PANEL.slice(i, PANEL.indexOf("});", i));
    expect(block).toMatch(/만료 D-\$\{days\}/);
    expect(block).toMatch(/lot \$\{item\.lotNumber \|\| "N\/A"\}/);
    expect(block).not.toMatch(/0\.\d/);
  });
});
