/**
 * §11.180 #operational-brief-density-up-other-surfaces (Phase 2: inventory)
 *   → 🔴 2026-09-13 승계·은퇴 (§baseline-red-ledger · C 분류)
 *
 * 무슨 일이 있었나
 *   이 파일은 "핵심 근거" 섹션의 4-cell MetricCell grid · InfoRow 4 · 옛 톤 경계를 핀하고 있었다.
 *   그 형태는 이미 결정으로 교체됐다:
 *     §11.320 Phase 3   "핵심 근거" → "재고 현황" · 메타 InfoRow 4 → 1줄
 *     §11.322 Phase 2   MetricCell 카드 제거 → 인라인 라벨-값 row 4 · 위험은 텍스트 색
 *     §inventory-brief-delta(2026-07-29) "만료 임박" → "최단 유효기간" · D-day 배지 ≤30 red / ≤90 yellow
 *   앵커 `"핵심 근거"` 가 null 을 돌려주며 5건이 RED 였고 기준선 더미에 묻혀 있었다.
 *   🛑 화면 회귀가 아니다 — 내용(수량 톤 · 안전재고 · 유효기간 신호 · 최단 LOT · 메타)은 전부 살아 있다.
 *
 * 은퇴 (승계자가 명제를 이미 진다)
 *   - "MetricCell + formatRelativeKr import"  → 322 "MetricCell 카드 강조 패턴 0". 두 import 는 지금
 *     **사용처 0**(죽은 import)이다. 이 핀이 남으면 lint 정리가 RED 로 막힌다 — §sentinel-inversion 형태.
 *   - "4-cell grid (grid-cols-2 + 4 MetricCell)" → 322 "인라인 row 4 · grid-cols-3 카드 패턴 제거" 가 정반대를 금지.
 *   - "4 MetricCell label"                    → 320 "KPI 핵심 3 testid" + 322 "인라인 row 4(현재/안전재고/만료/최단 LOT)".
 *
 * 승계 (승계자 없음 — 320·322 가 경계값과 메타를 잠그지 않는다)
 *   - 수량 톤 경계   0 → danger · 안전재고 **이하** → warn · 그 외 ok
 *                   ⚠️ 옛 제목은 "미만" 이었으나 단언은 이미 `<=` 였다. 정본은
 *                      lib/inventory/reorder-need.ts:33 isReorderNeeded `currentQuantity <= safetyStock`.
 *   - 유효기간 배지   <0 만료됨 red · ≤30 red · ≤90 yellow · 그 외 배지 없음 · null 은 "-"  (brief-delta 결정)
 *   - 메타 1줄       카테고리 · 보관(formatStorageCondition) · 위치 · 시험항목(있을 때만)
 *
 * 창은 블록으로 연다 — "재고 현황" SectionHeader 가 속한 <section> 여는 태그부터 짝 </section> 까지.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../../_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PATH = "src/components/inventory/inventory-context-panel.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

/** "재고 현황" 섹션 블록 — 여는 <section 부터 첫 </section> 까지 (고정 폭 슬라이스 금지). */
function stockSection(src: string): string {
  const label = src.indexOf('label="재고 현황"');
  if (label < 0) return "";
  const start = src.lastIndexOf("<section", label);
  const end = src.indexOf("</section>", label);
  if (start < 0 || end < 0) return "";
  return src.slice(start, end + "</section>".length);
}

describe("§11.180 승계 — inventory-context-panel 재고 현황 섹션", () => {
  it("재고 현황 섹션이 존재한다 (0 을 성공으로 읽지 않는다)", () => {
    const block = stockSection(read(PATH));
    expect(block.length, "재고 현황 섹션 미발견").toBeGreaterThan(200);
    expect(block).toMatch(/<SectionHeader[^>]*label="재고 현황"/);
  });

  it("수량 톤 경계 — 0 → danger / 안전재고 이하 → warn / 그 외 ok (정본 isReorderNeeded 와 같은 경계)", () => {
    const block = stockSection(read(PATH));
    expect(block).toMatch(/qtyTone[\s\S]*?currentQuantity\s*===\s*0[\s\S]*?"danger"/);
    expect(block).toMatch(/currentQuantity\s*<=\s*item\.safetyStock[\s\S]*?"warn"/);
    expect(block).toMatch(/"ok"/);
    // 정본과 경계가 같다는 것을 한 번 더 — 정본이 "미만" 으로 바뀌면 여기서 갈린다
    const canonical = read("src/lib/inventory/reorder-need.ts");
    expect(canonical).toMatch(/currentQuantity\s*<=\s*inv\.safetyStock/);
  });

  it("유효기간 배지 — <0 만료됨 red / ≤30 red / ≤90 yellow / null 은 '-' (brief-delta 7/29)", () => {
    const block = stockSection(read(PATH));
    expect(block).toMatch(/kpiExpiryDays\s*===\s*null\s*\?\s*"-"/);
    expect(block).toMatch(/kpiExpiryDays\s*<\s*0[\s\S]*?"만료됨"[\s\S]*?bg-red-50/);
    expect(block).toMatch(/kpiExpiryDays\s*<=\s*30[\s\S]*?bg-red-50/);
    expect(block).toMatch(/kpiExpiryDays\s*<=\s*90[\s\S]*?bg-yellow-50/);
    // amber 금지 조항 — 주의색은 yellow
    expect(stripComments(block)).not.toMatch(/\bamber-\d/);
  });

  it("메타 1줄 — 카테고리 · 보관 · 위치 · 시험항목(있을 때) 보존 (§11.320 P3 압축)", () => {
    const block = stockSection(read(PATH));
    expect(block).toMatch(/카테고리<\/span>\s*\{item\.category/);
    expect(block).toMatch(/formatStorageCondition\(item\.storageCondition\)/);
    expect(block).toMatch(/item\.location\s*\|\|\s*"위치 미지정"/);
    expect(block).toMatch(/시험항목<\/span>\s*\{item\.testPurpose\}/);
  });
});

describe("§11.180 승계 — 회귀 0 (은퇴한 형태가 되살아나지 않는다)", () => {
  it("'핵심 근거' 라벨 · MetricCell 카드가 섹션에 없다 (주석 제외)", () => {
    const code = stripComments(stockSection(read(PATH)));
    expect(code).not.toMatch(/"핵심 근거"/);
    expect(code).not.toMatch(/<MetricCell\b/);
    expect(code).not.toMatch(/<InfoRow\b/);
  });
});
