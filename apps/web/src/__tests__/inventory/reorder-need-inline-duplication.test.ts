/**
 * §reorder-need-inline-duplication — 재주문 판정 **명제의 복제**를 센다 (2026-09-20)
 *
 * 기존 `reorder-need-single-definition.test.ts` 는 `isReorderNeeded*` 라는 **이름**의 재정의를 문다.
 * 이름 없이 같은 명제를 인라인으로 복제한 자리는 그 축 밖이다 — 실측으로 12 파일 31 곳이 있었다.
 * 그래서 이 검사는 이름이 아니라 **형태**를 문다:
 *   축 A  수량 <= 일사용량 × 리드타임          (곱셈)
 *   축 A' 수량/일사용량(또는 잔여일수) <= 리드타임 (나눗셈 — 같은 명제, 표기만 다르다)
 *   축 B  수량 <= 안전재고
 *
 * 정본: `src/lib/inventory/reorder-need.ts` (§stock-risk-consolidation P3 · 호영님 2026-07-03)
 *   1) dailyUsage>0 && leadTime>0 && qty <= dailyUsage×leadTime   2) safetyStock!=null && qty <= safetyStock
 *   3) safetyStock==null 이면 qty <= 0
 *
 * 이 검사는 **등록부**다. 자리를 0 으로 단언하지 않는다 — 오늘 31 곳이 살아 있고, 한 번에 닫을 수 없다.
 * 대신 집합을 리터럴로 고정한다(§개수는 명제가 아니다):
 *   새 복제가 생기면 RED · 자리를 정본 호출로 닫아도 RED(목록에서 지우고 커밋을 같은 줄에 적는다).
 *
 * 🛑 **검출기가 무는 것은 명제의 형태이지 값이 아니다.** 비교식 하나를 정본과 대조해 "값이 갈린다" 고
 *    선언하면 틀린다 — 그 비교식에 **도달하기 전에 무엇이 걸러지는지**가 값을 정한다. 실측 2026-09-20:
 *      scan/page 2곳   truthy 가드지만 앞 분기 `qty <= 0`("재고 없음")이 그 경우를 먼저 잡는다 → 값 일치
 *      ai-panel:158    갈리지만 구간은 `safetyStock === 0 && qty <= 0` 하나 · truthy 가드가 바로 다음 줄
 *                      `ratio = qty / safetyStock` 의 0 나누기를 막고 있다(정본 준수로 바꾸면 "NaN%" 를 띄운다)
 *    그래서 아래 분류는 **형태**만 자동으로 세고, 값 확정은 사람이 분기 전체를 읽은 자리만 표기한다.
 *
 * 한계: 변수명으로 수량·안전재고·리드타임을 식별한다. 다른 이름으로 담아 비교하면 이 축 밖이다.
 *   임계 배수(×1.5 리드타임 여유 · ×0.5 · ×0.3 위험구간)는 **다른 명제**라 대상이 아니다 — 아래 THRESHOLD 참조.
 *   자리별 값 판정은 자동화되지 않는다(31곳 전수 대상 · 별도 트랙 · 호영님 순서 판정 대기).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..", "..");
const CANON = "lib/inventory/reorder-need.ts";

/** 주석과 문자열 리터럴을 공백으로 지운다 — 명세 문구가 코드로 잡히지 않도록(실측 오탐 1건). */
function strip(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      let out = "";
      let q: string | null = null;
      let esc = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (esc) { esc = false; out += " "; continue; }
        if (c === "\\") { esc = true; out += " "; continue; }
        if (q) { if (c === q) { q = null; out += c; } else out += " "; continue; }
        if (c === '"' || c === "'" || c === "`") { q = c; out += c; continue; }
        if (c === "/" && line[i + 1] === "/") break;
        out += c;
      }
      return out;
    })
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

const QTY = "(?:[\\w.?\\[\\]\"']*(?:currentQuantity|quantity|qty|onHand)[\\w.?\\[\\]\"']*)";
const USE = "(?:[\\w.?\\[\\]\"']*(?:dailyUsage|averageDailyUsage|avgDaily|usagePerDay)[\\w.?\\[\\]\"']*)";
const LEAD = "(?:[\\w.?\\[\\]\"']*(?:leadTime|leadTimeDays)[\\w.?\\[\\]\"']*)";
const SAFE = "(?:[\\w.?\\[\\]\"']*(?:safetyStock|minStock|minimumStock)[\\w.?\\[\\]\"']*)";
const DAYS = "(?:[\\w.?\\[\\]\"']*(?:daysRemaining|daysLeft|remainingDays|coverageDays)[\\w.?\\[\\]\"']*)";
const N = "(?:\\s*\\?\\?\\s*\\d+)?";

const AXES: Array<[string, RegExp]> = [
  ["A", new RegExp(`${QTY}${N}\\s*(<=|<)\\s*\\(?\\s*(?:${USE}${N}\\s*\\*\\s*${LEAD}|${LEAD}${N}\\s*\\*\\s*${USE})`, "g")],
  ["A'", new RegExp(`(?:${QTY}\\s*/\\s*${USE}|${DAYS})${N}\\s*(<=|<)\\s*${LEAD}`, "g")],
  ["B", new RegExp(`${QTY}${N}\\s*(<=|<)\\s*${SAFE}`, "g")],
];

interface Site { file: string; axis: string; boundary: string; guard: string; threshold: string | null }

function scan(): Site[] {
  const files: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!["__tests__", "generated", "node_modules"].includes(e.name)) walk(p); }
      else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) files.push(p);
    }
  })(SRC);

  const out: Site[] = [];
  for (const f of files) {
    const rel = relative(SRC, f).split("\\").join("/");
    if (rel === CANON) continue;
    const code = strip(readFileSync(f, "utf8").replace(/\r\n/g, "\n"));
    for (const [axis, re] of AXES) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        const tail = code.slice(m.index + m[0].length, m.index + m[0].length + 20).match(/^\s*[*/]\s*([\d.]+)/);
        const before = code.slice(Math.max(0, m.index - 200), m.index);
        let guard = "없음";
        if (/safetyStock\s*!==?\s*(?:null|undefined)/.test(before)) guard = "null비교";
        else if (/safetyStock\s*(?:\?\?|\|\|)/.test(before)) guard = "기본값";
        else if (/\bsafetyStock\s*&&/.test(before)) guard = "truthy";
        out.push({ file: rel, axis, boundary: m[1], guard: axis === "B" ? guard : "-", threshold: tail ? tail[1] : null });
      }
    }
  }
  return out;
}

const sites = scan();
const duplicates = sites.filter((s) => s.threshold === null);
const thresholds = sites.filter((s) => s.threshold !== null);
const key = (s: Site) => `${s.file} ${s.axis}${s.boundary} 가드:${s.guard}`;

describe("§reorder-need-inline-duplication · 정본과 같은 명제를 인라인으로 복제한 자리", () => {
  it("측정 대상이 실제로 존재한다 · 0건 통과를 통과로 세지 않는다", () => {
    expect(sites.length).toBeGreaterThan(20);
  });

  it("복제 자리 집합 (닫으면 목록에서 지우고 커밋을 같은 줄에 적는다)", () => {
    const counted: Record<string, number> = {};
    for (const s of duplicates) counted[key(s)] = (counted[key(s)] ?? 0) + 1;
    expect(counted).toEqual({
      // 서버 축 — 카운트가 화면과 같아야 하는 자리
      "app/api/dashboard/stats/route.ts B<= 가드:null비교": 1,
      "app/api/dashboard/summary/route.ts A<= 가드:-": 1, // 정본 독블록의 통합 대상 3곳 밖 · 복합 판정 복제
      "app/api/dashboard/summary/route.ts B<= 가드:null비교": 2,
      "app/api/inventory/route.ts B<= 가드:null비교": 1,
      // 화면 축
      "app/dashboard/inventory/inventory-content.tsx B<= 가드:null비교": 6, // 9→6 · §inventory-dead-tabs-removed(2026-09-26): 죽은 `{false &&` 블록 3개 + 고아 컴포넌트 3개 삭제로 3곳이 같이 사라졌다(정본 호출로 닫은 것이 아니다)
      "app/dashboard/inventory/scan/page.tsx B<= 가드:truthy": 2, // 앞 분기 qty <= 0 이 먼저 잡는다 · 값 일치 확정
      "components/inventory/InventoryTable.tsx A<= 가드:-": 1, // 복합 판정을 "부족" 라벨 안에 복제
      "components/inventory/InventoryTable.tsx B<= 가드:null비교": 1,
      "components/inventory/ReorderReviewSheet.tsx B<= 가드:null비교": 1,
      "components/inventory/inventory-context-panel.tsx A'<= 가드:-": 1,
      "components/inventory/inventory-context-panel.tsx B<= 가드:null비교": 4,
      // 제거됨: "components/inventory/stock-lifespan-gauge.tsx B<= 가드:없음" — §inventory-dead-tabs-removed(2026-09-26) 파일 삭제(importer 0)
      "hooks/use-inventory-ai-panel.ts B<= 가드:truthy": 1, // 🛑 값 갈림(safetyStock === 0 && qty <= 0) · 0 나누기 가드 겸용
      "hooks/use-inventory-ai-panel.ts B<= 가드:없음": 1, // 🛑 값 갈림(같은 구간) · 삼항 : false (:247)
      // 🛑 경계가 정본과 다르다(정본 <=, 여기 <) — 판정 대기
      "lib/inventory/flow-insight-engine.ts A'< 가드:-": 2,
      "lib/inventory/flow-insight-engine.ts B<= 가드:null비교": 1,
      "lib/operations/state-definitions.ts B<= 가드:null비교": 1,
    });
  });

  it("🛑 임계 배수가 붙은 자리는 다른 명제다 · 복제로 세지 않는다", () => {
    expect(thresholds.map((s) => `${s.file} ×${s.threshold}`).sort()).toEqual([
      // 제거됨: "components/inventory/stock-lifespan-gauge.tsx ×0.3"(위험 구간 톤) — §inventory-dead-tabs-removed(2026-09-26) 파일 삭제
      "lib/inventory/flow-insight-engine.ts ×0.5",
      "lib/operational-brief/build-rationale.ts ×1.5", // 리드타임 여유 — 호영님 판정 대기 항목
    ]);
  });

  it("경계가 정본(<=)과 다른 형태 · 등호 자리에서 답이 뒤집힌다", () => {
    // 앞 분기는 `usage > 0 && lead > 0` 뿐이라 등호(qty === usage×lead)를 걸러 주지 않는다 → 값이 갈린다.
    // 🛑 판정 대기: 게이지 `<`(07-12) vs canonical `<=`(07-03) 결정 충돌. 판정 없이 건드리지 않는다.
    expect(duplicates.filter((s) => s.boundary === "<").map(key)).toEqual([
      "lib/inventory/flow-insight-engine.ts A'< 가드:-",
      "lib/inventory/flow-insight-engine.ts A'< 가드:-",
    ]);
  });

  it("널 가드가 정본과 다른 형태 · 값 확정은 자리마다 다르다", () => {
    // 형태만 센다. 아래 표기는 사람이 분기 전체를 읽고 확정한 것만이다(나머지는 미확정).
    const byGuard = duplicates.filter((s) => s.guard === "truthy" || s.guard === "없음");
    expect(byGuard.map((s) => `${s.file} 가드:${s.guard}`).sort()).toEqual([
      // 값 일치 확정 — 앞 분기 `qty <= 0`("재고 없음")이 safetyStock === 0 경우를 먼저 잡는다
      "app/dashboard/inventory/scan/page.tsx 가드:truthy",
      "app/dashboard/inventory/scan/page.tsx 가드:truthy",
      // 제거됨: 게이지 톤 분기(값 미확정) — §inventory-dead-tabs-removed(2026-09-26) 파일 삭제
      // 값 갈림(좁은 구간 safetyStock === 0 && qty <= 0) · truthy 가드가 0 나누기 겸용 → 단순 치환 금지
      "hooks/use-inventory-ai-panel.ts 가드:truthy",
      // 값 갈림(같은 구간) · 삼항 `: false` 형태 (:247) — 0 나누기 겸용은 아니다
      "hooks/use-inventory-ai-panel.ts 가드:없음",
    ]);
  });
});
