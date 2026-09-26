/**
 * §inventory-state-tone-single-source · 재고 상태 색은 한 함수에서만 나온다 (호영님 판정 2026-09-26)
 *
 * 무엇이 문제였나 — 같은 사건이 세 색으로 나왔다
 *   안전재고 미만   KPI `#b91c1c`/`rose-700` · 표 배지 `yellow-500` · 패널 `yellow-100` · 게이지 `yellow-500`
 *   재발주 필요     KPI red · 표 배지 `blue-500`
 *   §11.283a 는 「재주문 = red · 안전재고 미달 = red」 를 잠그고 있었고, CLAUDE.md §9 본문 리스트는
 *   「낮은 재고 = yellow」 라고 적고 있었다 — **조항 안에 두 갈래**가 있었고 표면마다 다른 쪽을 따랐다.
 *   뿌리는 색이 아니라 구조였다: KPI·InventoryTable·context-panel 이 **각자 색 맵을 들고 있었다.**
 *
 * 호영님 판정표 (재고 화면에서 색은 「지금 손대야 하나」 를 말한다)
 *   red      조치 필요   품절 · 안전재고 미만 · 재주문 필요 · 만료 · 폐기 대상
 *   yellow   주시        만료 임박
 *   emerald  정상        정상
 *   · 상태 배지에서 blue 는 뺀다 — 「재발주 필요」 는 red (§11.302d-3 이 품절을 blue→red 로 고친 것과 같은 방향)
 *   · 품절과 미달은 색이 아니라 **라벨 문구**로 구분한다
 *
 * §11.302d 재앵커 지점이 여기다
 *   302d-1/d-2/d-3 의 카드 배경·배지 단언은 `{false && (…)}` 안을 재고 있어서
 *   **집행된 적이 없었다**(§inventory-dead-tabs-removed 에서 은퇴). 그 명제가 돌아올 자리가 이 파일이고,
 *   앵커는 구현 내부명·라인이 아니라 **정본 함수의 입출력**이다.
 *
 * 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점)
 *   1. 상호작용 색 — 필터 활성 blue 링 · 버튼 hover · 탭 카운트 배지(`bg-rose-500`).
 *      §9 의 「정보(실행 가능 CTA)」 축이고 상태 축이 아니다. 이 함수로 끌어오지 않는다.
 *   2. `needs_review`(보관 조건 불일치 · 공급사 미지정 · 위치 미지정) 3종은 판정표에 없는 줄이라
 *      **보이던 대로 yellow 에 뒀다.** 판정이 오면 정본의 그 줄만 옮긴다.
 *   3. 런타임 색이 아니라 소스 형태만 본다. 실제 화면 red 확인은 배포 후 실측이 정본이다
 *      (재실측 기준: 안전재고 미만 품목이 KPI · 표 배지 · 패널 · 게이지 네 곳 모두 red).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import {
  inventoryStateTone,
  inventoryToneClass,
  inventoryStatusLabelToState,
  inventoryQuantityState,
  INVENTORY_TONE_CLASS,
  type InventoryToneState,
} from "@/lib/inventory/state-tone";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const CONTENT = code("app/dashboard/inventory/inventory-content.tsx");
const TABLE = code("components/inventory/InventoryTable.tsx");
const PANEL = code("components/inventory/inventory-context-panel.tsx");
const LIB = code("lib/inventory/state-tone.ts");
const QUEUE = code("components/inventory/priority-action-queue.tsx");

/**
 * 여는 중괄호부터 대응 닫는 중괄호까지 — 고정 폭 슬라이스 금지(§4원칙 ⑤).
 * 🛑 `openAfter` 가 필요한 이유: `function F({ a }: { a: string })` 는 **첫 중괄호가 구조분해**라
 *    그것부터 열면 창이 파라미터에서 끝난다(실측 1건 · §4원칙 ② 창 시작점).
 */
function blockFrom(src: string, startIdx: number, openAfter?: string): string {
  const from = openAfter ? src.indexOf(openAfter, startIdx) : startIdx;
  const open = src.indexOf("{", from < 0 ? startIdx : from);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  return src.slice(startIdx);
}

describe("§inventory-state-tone · 판정표 그대로 (함수 입출력)", () => {
  it("red = 조치 필요 · 다섯 상태", () => {
    /* 🛑 집합을 리터럴로 고정한다 — 개수는 명제가 아니다(§개수는 명제가 아니다). */
    const red: InventoryToneState[] = [
      "out_of_stock",
      "below_safety",
      "reorder_needed",
      "expired",
      "disposal_target",
    ];
    for (const s of red) expect(inventoryStateTone(s)).toBe("red");
  });

  it("yellow = 주시 · emerald = 정상 · neutral = 판별 불가", () => {
    expect(inventoryStateTone("expiring_soon")).toBe("yellow");
    expect(inventoryStateTone("needs_review")).toBe("yellow");
    expect(inventoryStateTone("normal")).toBe("emerald");
    expect(inventoryStateTone("unknown")).toBe("neutral");
  });

  it("🛑 상태 축 전량이 판정표에 배정돼 있다 (「일단 neutral」 로 새는 것 0)", () => {
    /* 멤버가 늘면 여기서 걸린다 — 이름까지 리터럴로 고정한다(값만 세면 개명·오타를 놓친다). */
    const all = Object.keys(
      {
        out_of_stock: 0,
        below_safety: 0,
        reorder_needed: 0,
        expired: 0,
        disposal_target: 0,
        expiring_soon: 0,
        needs_review: 0,
        normal: 0,
        unknown: 0,
      } satisfies Record<InventoryToneState, number>,
    ).sort();
    /* 정본 파일의 STATE_TONE 키 집합과 일치해야 한다. */
    const lib = [...LIB.matchAll(/^  (\w+): "(red|yellow|emerald|neutral)",$/gm)].map((m) => m[1]).sort();
    expect(lib).toEqual(all);
    /* 🛑 **타입 유니온도 같이 본다.** 멤버를 유니온에만 더해도 STATE_TONE 키는 그대로라
     *    위 단언만으로는 통과한다(프로브 실측 1건). 배정 없는 상태가 새 나가는 경로를 닫는다.
     *    tsc 가 Record 누락을 잡긴 하지만, 게이트가 둘로 갈리면 한쪽만 보고 land 된다. */
    const decl = LIB.slice(LIB.indexOf("export type InventoryToneState ="));
    const union = [...decl.slice(0, decl.indexOf(";")).matchAll(/"(\w+)"/g)].map((m) => m[1]).sort();
    expect(union).toEqual(all);
  });

  it("톤 → 클래스가 신호등 팔레트다 (amber 금지 · blue 금지)", () => {
    expect(INVENTORY_TONE_CLASS.red.text).toBe("text-red-700");
    expect(INVENTORY_TONE_CLASS.red.dot).toBe("bg-red-500");
    expect(INVENTORY_TONE_CLASS.yellow.text).toBe("text-yellow-700");
    expect(INVENTORY_TONE_CLASS.emerald.dot).toBe("bg-emerald-500");
    expect(INVENTORY_TONE_CLASS.neutral.dot).toBe("bg-slate-300");
    /* 큐 카드 슬롯 — 비워도 통과하던 자리(프로브 실측 1건). 값까지 고정한다. */
    expect(INVENTORY_TONE_CLASS.red.leftAccent).toBe("border-l-red-400");
    expect(INVENTORY_TONE_CLASS.yellow.leftAccent).toBe("border-l-yellow-400");
    expect(INVENTORY_TONE_CLASS.red.softBg).toBe("bg-red-50/40 hover:bg-red-50");
    for (const t of ["red", "yellow", "emerald", "neutral"] as const) {
      expect(INVENTORY_TONE_CLASS[t].leftAccent).not.toBe("");
    }
    const all = JSON.stringify(INVENTORY_TONE_CLASS);
    expect(all).not.toMatch(/amber-/);
    expect(all).not.toMatch(/orange-/);
    expect(all).not.toMatch(/\bblue-/);
    expect(all).not.toMatch(/rose-/);
  });

  it("레거시 라벨 · 수량 두 입구가 같은 판정표로 떨어진다", () => {
    expect(inventoryStateTone(inventoryStatusLabelToState("부족"))).toBe("red");
    expect(inventoryStateTone(inventoryStatusLabelToState("재주문 권장"))).toBe("red");
    expect(inventoryStateTone(inventoryStatusLabelToState("소진 임박 D-3"))).toBe("red");
    expect(inventoryStateTone(inventoryStatusLabelToState("만료"))).toBe("red");
    expect(inventoryStateTone(inventoryStatusLabelToState("폐기"))).toBe("red");
    expect(inventoryStateTone(inventoryStatusLabelToState("임박"))).toBe("yellow");
    expect(inventoryStateTone(inventoryStatusLabelToState("정상"))).toBe("emerald");
    /* 판별 불가를 정상으로 세지 않는다. */
    expect(inventoryStatusLabelToState("듣보 상태")).toBe("unknown");
    expect(inventoryStatusLabelToState(null)).toBe("unknown");
    /* 수량 입구 — 0 이 먼저다(둘 다 red 지만 라벨이 다르다). */
    expect(inventoryQuantityState(0, 5)).toBe("out_of_stock");
    expect(inventoryQuantityState(3, 5)).toBe("below_safety");
    expect(inventoryQuantityState(9, 5)).toBe("normal");
    expect(inventoryQuantityState(9, null)).toBe("normal");
  });
});

describe("§inventory-state-tone · 다섯 표면에 로컬 상태→색 맵이 없다", () => {
  it("패널의 구 색 맵 3종이 사라졌다", () => {
    for (const name of ["SEVERITY_STYLE", "RISK_CARD_STYLE", "LOT_STATUS_STYLE"]) {
      expect(PANEL).not.toMatch(new RegExp(name));
    }
    /* severity 로 색을 고르는 형태 자체를 막는다. */
    expect(PANEL).not.toMatch(/\[risk\.severity\]/);
  });

  it("🛑 세 표면에 색 문자열을 담은 새 맵이 생기지 않는다", () => {
    const offenders: string[] = [];
    for (const [file, src] of [
      ["inventory-content.tsx", CONTENT],
      ["InventoryTable.tsx", TABLE],
      ["inventory-context-panel.tsx", PANEL],
      /* 🛑 다섯 번째 표면 — 호영님 라이브 실측으로 드러났다(우선 처리 큐가 함수를 우회했다). */
      ["priority-action-queue.tsx", QUEUE],
    ] as const) {
      for (const m of src.matchAll(/const (\w+)\s*:\s*Record<[^>]*>\s*=\s*\{/g)) {
        const block = blockFrom(src, m.index ?? 0);
        if (/(bg|text|border)-(red|yellow|emerald|rose|amber|orange|blue)-/.test(block)) {
          offenders.push(file + " :: " + m[1]);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("표 배지가 정본만 부른다 (창 = 함수 블록)", () => {
    const i = TABLE.indexOf("function StatusBadge(");
    expect(i).toBeGreaterThan(0);
    const block = blockFrom(TABLE, i, "}) {");
    expect(block).toMatch(/inventoryStatusLabelToState\(status\)/);
    expect(block).toMatch(/inventoryToneClass\(state\)/);
    /* 🛑 우회 금지 — 배지 블록 안에 원색 리터럴이 하나도 없어야 한다. */
    expect(block).not.toMatch(/(bg|text|border)-(red|yellow|emerald|rose|amber|orange|blue)-/);
  });

  it("게이지·행 틴트가 정본을 부른다", () => {
    expect(TABLE).toMatch(/const barColor = inventoryToneClass\(inventoryQuantityState\(group\.totalQuantity, group\.safetyStock\)\)\.bar;/);
    expect(TABLE).toMatch(/inventoryToneClass\(inventoryStatusLabelToState\(displayStatus\)\)\.rowTint/);
    /* 구 게이지 삼항(0=red · 미달=yellow · 정상=emerald)이 돌아오면 RED. */
    expect(TABLE).not.toMatch(/totalQuantity <= safety \? "bg-yellow-500"/);
  });

  it("패널 리스크·lot 배지가 정본을 부른다", () => {
    expect(PANEL).toMatch(/inventoryToneClass\(risk\.state\)\.card/);
    expect(PANEL).toMatch(/inventoryToneClass\(risk\.state\)\.badge/);
    expect(PANEL).toMatch(/inventoryToneClass\(LOT_STATE\[lot\.status\] \?\? "unknown"\)\.badge/);
    /* 리스크가 상태 축을 들고 있다 — 색이 severity 에서 나오지 않는다는 구조적 근거. */
    expect(PANEL).toMatch(/state: InventoryToneState;/);
    expect(PANEL).toMatch(/state: inventoryQuantityState\(item\.currentQuantity, item\.safetyStock\)/);
  });

  it("KPI 네 자리가 정본을 부른다 (rose · 16진 리터럴 은퇴)", () => {
    expect(CONTENT).toMatch(/inventoryToneClass\("below_safety"\)\.text/);
    expect(CONTENT).toMatch(/inventoryToneClass\("below_safety"\)\.dot/);
    expect(CONTENT).toMatch(/inventoryToneClass\("expiring_soon"\)\.text/);
    /* 구 토큰 부활 차단 — 상태 자리에서만 본다(탭 카운트 배지 bg-rose-500 은 상태 축이 아니다). */
    expect(CONTENT).not.toMatch(/text-rose-700/);
    expect(CONTENT).not.toMatch(/text-\[#b91c1c\]/);
    expect(CONTENT).not.toMatch(/bg-\[#b91c1c\]/);
  });
});

describe("§inventory-state-tone · 후속 4건 (호영님 라이브 실측 2026-09-26)", () => {
  it("① 표 수량 숫자가 정본 톤을 쓴다 (숫자만 yellow 로 남지 않는다)", () => {
    /* 실측: 안전재고 미만 행의 배지는 red 인데 수량 숫자 「1」 이 text-yellow-600 이었다. */
    expect(TABLE).toMatch(/const quantityToneState = inventoryStatusLabelToState\(displayStatus\);/);
    const hits = [...TABLE.matchAll(/quantityToneState === "normal" \? "text-slate-900" : inventoryToneClass\(quantityToneState\)\.text/g)];
    /* 렌더 경로가 둘(표 행 · 카드 행)이라 둘 다 본다 — 경로는 OR 로 묶지 않는다. */
    expect(hits).toHaveLength(2);
    expect(TABLE).not.toMatch(/groupStatus === "부족" \? "text-yellow-/);
  });

  it("② 조치 버튼은 상태색을 쓰지 않는다 (중립 고정)", () => {
    /* 재발주 · 교체 주문 · 출고 — 조치 버튼이 「주시」 색을 입으면 같은 행의 red 배지와 어긋난다. */
    expect(TABLE).not.toMatch(/text-yellow-600 border-yellow-300/);
    expect(TABLE).not.toMatch(/border-yellow-500\/30/);
    expect(TABLE).not.toMatch(/text-blue-600 border-blue-300/);
    /* 버튼 색이 상태 분기에서 나오는 형태 자체를 막는다. */
    expect(TABLE).not.toMatch(/groupStatus === "부족"[\s\S]{0,40}\? "text-/);
  });

  it("③ 우선 처리 큐가 정본을 쓴다 · risk 는 색이 아니라 순위 라벨이다", () => {
    expect(QUEUE).toMatch(/const tone = inventoryToneClass\(CATEGORY_STATE\[item\.category\]\);/);
    expect(QUEUE).toMatch(/\$\{tone\.leftAccent\} \$\{tone\.softBg\}/);
    expect(QUEUE).toMatch(/\$\{tone\.dot\}/);
    expect(QUEUE).toMatch(/\$\{tone\.badge\}/);
    expect(QUEUE).toMatch(/\{RISK_LABEL\[item\.risk\]\}/);
    /* 구 severity 팔레트 부활 차단. */
    expect(QUEUE).not.toMatch(/RISK_CONFIG/);
    expect(QUEUE).not.toMatch(/riskCfg/);
    /* 분류 → 상태 배정이 판정표와 맞는가 — 뒤바뀐 두 줄을 그 자리에서 잠근다. */
    expect(QUEUE).toMatch(/reorder_priority: "reorder_needed"/);
    expect(QUEUE).toMatch(/expiring_soon: "expiring_soon"/);
    expect(QUEUE).toMatch(/disposal_review: "disposal_target"/);
  });

  it("④ 탭 이름이 하나다 (내용과 이름이 어긋나지 않는다)", () => {
    /* 실측: 비활성 「운영 현황 4」 → 누르면 「폐기 검토」 인데 내용은 재주문 큐였다. */
    expect(CONTENT).toMatch(/label: "운영 현황",/);
    expect(CONTENT).not.toMatch(/label: showLotIssueDecisionStrip \? "폐기 검토"/);
  });
});

describe("§inventory-state-tone · 재실측 기준 (안전재고 미만 품목이 네 곳에서 red)", () => {
  it("네 표면이 같은 상태에서 같은 톤을 낸다", () => {
    /* 🛑 이것이 이 트랙의 요지다 — 값이 같은 날에도 계산식이 다르면 결함이다.
     *    네 표면이 서로 다른 입구(라벨 · 수량 · 상태)로 들어와도 같은 톤에 도달해야 한다. */
    const fromTable = inventoryStatusLabelToState("부족"); // 표 배지
    const fromGauge = inventoryQuantityState(3, 5); // 게이지
    const fromPanel = inventoryQuantityState(3, 5); // 패널 리스크
    const fromKpi: InventoryToneState = "below_safety"; // KPI 칩
    const states = [fromTable, fromGauge, fromPanel, fromKpi];
    expect(states.map(inventoryStateTone)).toEqual(["red", "red", "red", "red"]);
    /* 톤이 같으면 클래스도 같다 — 네 입구가 같은 문자열에 도달한다. */
    expect(new Set(states.map((s) => inventoryToneClass(s).text)).size).toBe(1);
    expect(inventoryToneClass(fromTable).text).toBe("text-red-700");
  });
});
