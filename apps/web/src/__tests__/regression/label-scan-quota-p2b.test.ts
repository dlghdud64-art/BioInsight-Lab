/**
 * §pricing-enforce-p2 P2b — 라벨 스캔 월 카운터 enforce (호영님 2026-06-27)
 *
 * P1 이 plans.ts 에 maxLabelScansPerMonth(Free 10/이상 null) field 를 추가했으나 enforce 0(휴면).
 * 본 sentinel 은 라벨 스캔 월 한도를 실제 강제하도록 enforce + 카운트 SoT(LabelScanEvent) 를 검증한다.
 *   - prisma: LabelScanEvent 모델 + User.labelScanEvents 역관계
 *   - enforce-plan-limit: "labelScan" kind + maxLabelScansPerMonth 비교 + LabelScanEvent count
 *   - scan-label route: enforcePlanLimit("labelScan") 선제 차단(429) + 성공 시 LabelScanEvent 1건 insert
 * 회귀 0: quotes/inventory enforce·enforceAction RBAC·OCR lock(complete/fail) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const PLANS = read("lib/plans.ts");
const ENFORCE = read("lib/billing/enforce-plan-limit.ts");
const SCAN = read("app/api/inventory/scan-label/route.ts");
const SCHEMA = readFileSync(join(SRC, "..", "prisma", "schema.prisma"), "utf8");

describe("§pricing-enforce-p2 P2b — plans.ts 한도 (P1 land 재확인)", () => {
  it("maxLabelScansPerMonth Free 10 / 이상 null", () => {
    expect(PLANS).toMatch(/maxLabelScansPerMonth: 10/);
    expect(PLANS).toMatch(/maxLabelScansPerMonth: null/);
  });
});

describe("§pricing-enforce-p2 P2b — LabelScanEvent 카운트 SoT (schema)", () => {
  it("LabelScanEvent 모델 정의", () => {
    expect(SCHEMA).toMatch(/model LabelScanEvent \{/);
    expect(SCHEMA).toMatch(/userId\s+String/);
    expect(SCHEMA).toMatch(/@@index\(\[userId, createdAt\]\)/);
  });
  it("User.labelScanEvents 역관계", () => {
    expect(SCHEMA).toMatch(/labelScanEvents\s+LabelScanEvent\[\]/);
  });
});

describe("§pricing-enforce-p2 P2b — enforce labelScan kind", () => {
  it("PlanLimitKind 에 labelScan 포함", () => {
    expect(ENFORCE).toMatch(/PlanLimitKind = "quotes" \| "inventory" \| "labelScan"/);
  });
  it("labelScan 분기 — maxLabelScansPerMonth + LabelScanEvent count + null 통과", () => {
    expect(ENFORCE).toMatch(/kind === "labelScan"/);
    expect(ENFORCE).toMatch(/limits\.maxLabelScansPerMonth/);
    expect(ENFORCE).toMatch(/db\.labelScanEvent\.count\(\{ where: \{ userId, createdAt: \{ gte: monthStart \} \} \}\)/);
  });
  it("KIND_LABEL labelScan 라벨", () => {
    expect(ENFORCE).toMatch(/labelScan: "라벨 스캔"/);
  });
});

describe("§pricing-enforce-p2 P2b — scan-label 라우트 배선", () => {
  it("enforcePlanLimit/PlanLimitError import + labelScan 선제 차단 429", () => {
    expect(SCAN).toMatch(/import \{ enforcePlanLimit, PlanLimitError \} from "@\/lib\/billing\/enforce-plan-limit"/);
    expect(SCAN).toMatch(/enforcePlanLimit\(session\.user\.id, "labelScan"\)/);
    expect(SCAN).toMatch(/instanceof PlanLimitError/);
    expect(SCAN).toMatch(/status:\s*429/);
  });
  it("성공 시 LabelScanEvent 1건 insert (카운트 SoT)", () => {
    expect(SCAN).toMatch(/db\.labelScanEvent\.create\(\{ data: \{ userId: session\.user\.id \} \}\)/);
  });
  it("enforce 가 OCR 비용 前(enforceAction 前) 배치", () => {
    expect(SCAN.indexOf('enforcePlanLimit(session.user.id, "labelScan")'))
      .toBeLessThan(SCAN.indexOf("enforcement = enforceAction"));
  });
});

describe("§pricing-enforce-p2 P2b — 회귀 0", () => {
  it("quotes/inventory enforce 보존", () => {
    expect(ENFORCE).toMatch(/db\.quote\.count/);
    expect(ENFORCE).toMatch(/db\.productInventory\.count/);
    expect(ENFORCE).not.toMatch(/db\.order\.count/);
  });
  it("scan-label enforceAction RBAC + OCR lock 보존", () => {
    expect(SCAN).toMatch(/enforceAction\(\{/);
    expect(SCAN).toMatch(/enforcement\.complete\(\)/);
    expect(SCAN).toMatch(/enforcement\?\.fail\(\)/);
  });
});
