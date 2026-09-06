/**
 * §receiving-tx-metrics · §receiving-tx-audit-batch (호영님 2026-09-05, (A)+(B))
 *
 * (A) 계측 — 실패 사유에 "얼마나 걸렸는지" 와 실행 환경을 싣는다.
 *     🛑 계측이 timeout 조정보다 먼저다. 계측 없이 올리면 올린 게 먹었는지도 모른다.
 *        `finishReason` 을 읽고서야 잘림이 갈린 것과 같은 자리다.
 * (B) 감사 배치 — 라인마다 쓰던 것을 트랜잭션 끝에 한 번.
 *     판단: **트랜잭션 안**에 둔다(밖으로 빼면 일어나지 않은 입고가 감사에 남는다).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";
const HEALTH = "src/app/api/health/route.ts";

/** 다품목 `$transaction(...)` 블록 — 고정 폭 금지(4원칙 ⑤). */
function multiTxBlock(src: string): string {
  const start = src.indexOf("const results = await db.$transaction(");
  if (start < 0) throw new Error("다품목 트랜잭션 앵커를 찾지 못했다");
  const end = src.indexOf("// 알림 — 일괄 1건", start);
  if (end < 0) throw new Error("트랜잭션 닫는 자리를 찾지 못했다");
  return src.slice(start, end);
}

describe("§receiving-tx-audit-batch — 감사는 트랜잭션 안, 끝에 한 번", () => {
  it("루프 안에서 감사를 쓰지 않는다 (라인마다 왕복이 늘던 형태)", () => {
    const block = stripComments(multiTxBlock(read(ROUTE)));
    expect(block).not.toMatch(/await createAuditLog\(/);
    expect(block).toMatch(/auditRows\.push\(\{/);
  });

  it("createMany 로 한 번에 쓴다 — 라인 수와 무관하게 왕복 1", () => {
    const block = stripComments(multiTxBlock(read(ROUTE)));
    expect(block).toMatch(/await tx\.dataAuditLog\.createMany\(\{ data: auditRows \}\)/);
    expect(block).toMatch(/if \(auditRows\.length > 0\)/);
  });

  it("🛑 감사가 **트랜잭션 안**에 남는다 (밖으로 빼면 없던 입고가 기록된다)", () => {
    // createMany 호출이 tx 클라이언트를 쓴다 = 트랜잭션 안이라는 뜻.
    const block = multiTxBlock(read(ROUTE));
    expect(block).toMatch(/tx\.dataAuditLog\.createMany/);
    // 트랜잭션 밖(db.dataAuditLog)으로 이관되지 않았다.
    expect(stripComments(read(ROUTE))).not.toMatch(/db\.dataAuditLog\.createMany/);
  });

  it("회귀 0 — 감사 내용(entityType·action·source)이 보존된다", () => {
    const block = multiTxBlock(read(ROUTE));
    expect(block).toMatch(/entityType: AuditEntityType\.INVENTORY_RESTOCK/);
    expect(block).toMatch(/action: AuditAction\.CREATE/);
    expect(block).toMatch(/source: "smart_receiving_multi"/);
  });
});

describe("§receiving-tx-metrics — 왕복을 세고 사유에 싣는다", () => {
  it("모든 쓰기 지점 앞에서 왕복을 센다 + 감사 배치 1", () => {
    /* ⑤ 판별법 적용(2026-09-05): 처음에 5로 단언했다가 RED 가 났다.
     *   구현이 계약을 어긴 게 아니라 **내가 잘못 셌다** — 검사를 고친다.
     *   분기 A(기존): productInventory.update · inventoryRestock.create        = 2
     *   분기 B(신규): product.create · productInventory.create · restock.create = 3
     *   감사 배치                                                              = 1
     *   → 소스에 trip() 이 6곳. 실제 왕복 수는 라인 구성에 따라 달라진다:
     *     4품목(기존 3·신규 1) = 3×2 + 1×3 + 1 = 10  (배치 전 13에서 23% 감소) */
    const block = stripComments(multiTxBlock(read(ROUTE)));
    expect((block.match(/collector\.trip\(\)/g) ?? []).length).toBe(6);
  });

  it("분기별로 라인을 표시한다 (기존/신규 구성이 사유에 실린다)", () => {
    const block = stripComments(multiTxBlock(read(ROUTE)));
    expect(block).toMatch(/collector\.markExisting\(\)/);
    expect(block).toMatch(/collector\.markNew\(\)/);
  });

  it("catch 가 계측 + 실행 환경을 함께 싣는다", () => {
    const src = read(ROUTE);
    const idx = src.indexOf("const diag = [");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 500);
    expect(win).toMatch(/describeFailure\(error\)/);
    expect(win).toMatch(/describeTxMetrics\(txMetrics\.snapshot\(\)\)/);
    expect(win).toMatch(/describeRuntimeFacts\(readRuntimeFacts\(\)\)/);
    // 트랜잭션 진입 전 실패도 구분된다 — 값을 지어내지 않는다.
    expect(win).toMatch(/"tx=\(진입 전\)"/);
    expect(src).toMatch(/failReason: diag/);
  });

  it("txMetrics 가 catch 에서 보이는 자리에 선언된다", () => {
    expect(read(ROUTE)).toMatch(/let txMetrics: TxMetricsCollector \| null = null;/);
  });
});

describe("§receiving-tx-budget — timeout 은 명시하되 상향을 처방으로 삼지 않는다", () => {
  it("$transaction 에 timeout·maxWait 이 명시돼 있다 (구: 미지정 = 기본 5000/2000)", () => {
    const src = read(ROUTE);
    const idx = src.indexOf("timeout: 15_000");
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(Math.max(0, idx - 200), idx + 120)).toMatch(/maxWait: 5_000/);
  });

  it("🛑 상향이 처방이 아님을 주석이 명시한다 (다음 사람이 더 올리지 않게)", () => {
    const src = read(ROUTE);
    const idx = src.indexOf("§receiving-tx-budget");
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(idx, idx + 500)).toMatch(/상향은 연기지 수정이 아니다/);
  });
});

describe("§runtime-facts — health 가 평시에도 축을 보여준다", () => {
  it("health 응답에 runtime 축이 실린다", () => {
    const src = read(HEALTH);
    expect(src).toMatch(/import \{ readRuntimeFacts \} from "@\/lib\/runtime-facts"/);
    expect(src).toMatch(/runtime: readRuntimeFacts\(\)/);
  });

  it("회귀 0 — 기존 진단 축 보존", () => {
    const src = read(HEALTH);
    for (const k of ["dbUrlPrefix", "node: process.version", "storage:", "migrations,"]) {
      expect(src, `축 누락: ${k}`).toContain(k);
    }
  });
});
