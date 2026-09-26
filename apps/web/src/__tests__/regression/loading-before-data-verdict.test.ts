/**
 * §loading-empty-state (호영님 착수 2026-09-14 · 릴레이 prod 측정) · **데이터가 도착하기 전에 판정을 그리지 않는다.**
 *
 * ── 왜 ──
 * 릴레이 prod 측정(브라우저 → www.labaxis.co.kr · 2026-09-14 · 목록 API 4.5s):
 *   재고 관리  응답 전 「전체 품목 0종 · 안전재고 미달 0건 · ✓ 정상」 · 실제로는 BCP 가 안전재고 10 대비 1개(부족)
 *              → **부족을 정상으로** 표시했다(안전 오표시 · 등급 최상).
 *   견적 관리  응답 전 「진행 중 견적 없음 · 총 0건 중 0건」 → 견적 8건이 **없다고** 표시했다(부재 오표시).
 *   입고 관리  「입고 목록 불러오는 중」 → 응답 후 0건 문구 · 올바른 레퍼런스(dashboard/receiving/page.tsx:234).
 *
 * 🛑 금지 대상은 숫자 0 이 아니라 **도착 전의 판정**이다. 응답이 온 뒤의 0건·「✓ 정상」 은 정상 동작이다.
 * 🛑 `isLoading` 은 기준이 못 된다 · React Query v5(5.90)는 세션 로딩 중 enabled:false 쿼리의 isLoading 을 false 로 준다.
 *    기준은 "응답이 도착했는가"(data !== undefined).
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. 런타임 타이밍 · 정적 검사다. 실제 첫 페인트는 prod 브라우저 측정이 판정한다.
 *   2. 대시보드 홈 · 입고 관리 · 그 외 화면(범위 제외 · 호영님 지시).
 *   3. 재고 화면의 다른 파생 신호(재발주 배너 등)는 0건이면 렌더하지 않아 판정 문구가 없다 · 여기서 보지 않는다.
 *   4. React #418(hydration mismatch)과의 인과 · 릴레이가 배포 후 콘솔로 잰다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));
const INV = "app/dashboard/inventory/inventory-content.tsx";
const MOB = "components/inventory/mobile-inventory-view.tsx";
const QUOTES = "app/dashboard/quotes/page.tsx";

/** testid 를 가진 요소의 여는 태그부터 대응 닫는 태그까지(4원칙 ②⑤ · 태그 이름으로 짝을 센다). */
function elementBlock(src: string, testid: string): string {
  const at = src.indexOf(`data-testid="${testid}"`);
  expect(at, `${testid} 없음`).toBeGreaterThan(-1);
  const open = src.lastIndexOf("<", at);
  const tag = src.slice(open + 1).match(/^[a-zA-Z]+/)![0];
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, "g");
  re.lastIndex = open;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[0].startsWith("</")) {
      if (--depth === 0) return src.slice(open, m.index + m[0].length);
    } else depth++;
  }
  throw new Error(`${testid} 닫힘 없음`);
}

describe("§loading-empty-state · 재고 · 도착 기준", () => {
  const inv = code(INV);

  it("🛑 도착 판정은 응답 도착(data !== undefined) · isLoading 이 아니다", () => {
    expect(inv).toMatch(/const inventoriesArrived =\s*inventoryView === "my" \? inventoryResponse !== undefined : !selectedTeam\?\.id \|\| teamInventoryData !== undefined;/);
    expect(inv).toMatch(/const kpiPending = !inventoriesArrived;/);
    expect(inv).not.toMatch(/const kpiPending = [^;]*isLoading/);
  });

  it("KPI 대기 표시는 판정 문구가 아니다 (불러오는 중 · 불러오지 못함)", () => {
    const body = inv.slice(inv.indexOf("function KpiPendingValue("));
    expect(body).toMatch(/"불러오지 못함" : "불러오는 중"/);
    expect(body.slice(0, 400)).not.toMatch(/정상|\d+\s*건/);
  });
});

describe("§loading-empty-state · 재고 KPI · 도착 전 분기가 판정보다 먼저다 (칸마다 각각)", () => {
  const inv = code(INV);

  it("🛑 만료 임박 · 도착 전 분기가 「✓ 정상」 과 숫자보다 앞", () => {
    const b = elementBlock(inv, "dashboard-inventory-header-kpi-expiring-soon");
    const pending = b.indexOf("{kpiPending ? (");
    expect(pending).toBeGreaterThan(-1);
    expect(pending).toBeLessThan(b.indexOf("✓ 정상"));
    expect(pending).toBeLessThan(b.indexOf("{headerKpiExpiringSoon}"));
  });

  it("🛑 안전재고 미달 · 도착 전 분기가 숫자보다 앞", () => {
    const b = elementBlock(inv, "dashboard-inventory-header-kpi-low-stock");
    const pending = b.indexOf("{kpiPending ? (");
    expect(pending).toBeGreaterThan(-1);
    expect(pending).toBeLessThan(b.indexOf("{headerKpiLowStock}"));
  });

  it("전체 품목 · 도착 전 분기가 숫자보다 앞", () => {
    const b = elementBlock(inv, "dashboard-inventory-header-kpi-total-items");
    const pending = b.indexOf("{kpiPending ? (");
    expect(pending).toBeGreaterThan(-1);
    expect(pending).toBeLessThan(b.indexOf("{headerKpiTotalItems}"));
  });

  it("모바일 KPI 3장 · 도착 전 분기가 값보다 앞", () => {
    const start = inv.indexOf('{ label: "전체 품목", value: displayInventories.length');
    expect(start).toBeGreaterThan(-1);
    const win = inv.slice(start, inv.indexOf("<MobileInventoryView", start));
    const pending = win.indexOf("{kpiPending ? (");
    expect(pending).toBeGreaterThan(-1);
    expect(pending).toBeLessThan(win.indexOf("{k.value}"));
  });
});

describe("§loading-empty-state · 재고 목록 · 도착 전에 「없음」 을 말하지 않는다", () => {
  it("🛑 목록 로딩 판정에 isLoading 삼항을 쓰지 않는다 (세션 로딩 틈)", () => {
    expect(code(INV)).not.toMatch(/\{isLoading \? \(/);
    /* 🛑 3 → 1 §inventory-dead-tabs-removed (2026-09-26 · 호영님 판정).
     *   삼항 형태 3곳 중 2곳이 `{false && (…)}` 안이었다 — 렌더 0 이므로 그 가드는 한 번도
     *   사용자를 지켜준 적이 없다. 남은 라이브 삼항은 표 목록 1곳(2194행)이고,
     *   모바일은 삼항이 아니라 `loading={!inventoriesArrived && !inventoriesError}` prop 전달(1661행)로
     *   같은 명제를 지킨다 — 아래 모바일 항목이 그쪽을 따로 단언한다.
     *   ⚠️ 처음 이 값을 2 로 적었다가 프로브에서 1 로 정정했다. 개수 핀은 「몇 개가 살아 있나」 를
     *      묻는데 그 답을 내가 형태를 세지 않고 추정했다(§결과를 읽기 전에 경계를 먼저 확인한다).
     *      자리 열거는 별건으로 둔다(「렌더 도달 0 census」 큐). */
    expect((code(INV).match(/\{!inventoriesArrived && !inventoriesError \? \(/g) ?? []).length).toBe(1);
  });

  it("모바일 목록 · 도착 전 분기가 「등록된 재고가 없습니다」 보다 앞 · 호출부가 도착 기준을 넘긴다", () => {
    const mob = code(MOB);
    expect(mob.indexOf("{loading ? (")).toBeGreaterThan(-1);
    expect(mob.indexOf("{loading ? (")).toBeLessThan(mob.indexOf("등록된 재고가 없습니다"));
    expect(code(INV)).toMatch(/<MobileInventoryView\s+inventories=\{displayInventories\}\s+loading=\{!inventoriesArrived && !inventoriesError\}/);
  });
});

describe("§loading-empty-state · 견적 · 도착 전에 퍼널·총계를 그리지 않는다", () => {
  const q = code(QUOTES);

  it("🛑 도착 판정은 응답 도착 기준", () => {
    expect(q).toMatch(/const quotesPending = quotesData === undefined && !isError;/);
  });

  it("🛑 퍼널(「진행 중 견적 없음」 을 그리는 컴포넌트)은 도착 뒤에만", () => {
    expect(q).toMatch(/\{quotesPending \? \([\s\S]{0,400}견적 불러오는 중[\s\S]{0,40}\) : \(\s*<QuoteFunnel/);
  });

  it("총계 「총 N건 중 M건」 은 도착 뒤에만", () => {
    expect(q).toMatch(/\{quotesPending \? "불러오는 중" : <>총 \{quotes\.length\}건 중 \{sortedQuotes\.length\}건<\/>\}/);
  });
});
