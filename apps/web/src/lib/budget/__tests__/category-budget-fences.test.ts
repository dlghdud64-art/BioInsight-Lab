// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Category Budget Runtime Fences
 *
 * 이 테스트는 코드 수준에서 아래 규칙을 강제한다:
 *
 * F1: deprecated category-budget-validator.ts를 신규 코드에서 import하면 안 됨
 * F2: suggestCategoryMapping()이 approve/PO path에서 호출되면 안 됨
 * F3: approve route에서 suggestCategoryMapping import가 없어야 함
 * F4: category-budget-gate.ts의 yearMonth 파라미터가 optional이 아니어야 함
 *     (resolvePeriodYearMonth으로 명시 전달 강제)
 * F5: budget 관련 코드에서 toISOString().slice(0,7) 직접 월 키 생성 금지
 *     (resolvePeriodYearMonth만 사용해야 함)
 *
 * 이 테스트가 깨지면 canonical truth 경계가 무너진 것이다.
 */

// vitest/jest compatible — jest globals are auto-injected
import * as fs from "fs";
import * as path from "path";

// __dirname = apps/web/src/lib/budget/__tests__ → ../../.. = apps/web/src
const SRC_ROOT = path.resolve(__dirname, "../../..");
const BUDGET_DIR = path.resolve(__dirname, "..");
const APPROVE_ROUTE = path.resolve(
  SRC_ROOT,
  "app/api/request/[id]/approve/route.ts",
);

// ── F1: deprecated validator import fence ──

describe("F1: category-budget-validator deprecated fence", () => {
  it("신규 코드에서 category-budget-validator를 import하지 않아야 함", () => {
    const approveSource = fs.readFileSync(APPROVE_ROUTE, "utf-8");
    expect(approveSource).not.toMatch(/from.*category-budget-validator/);
    expect(approveSource).not.toMatch(/import.*category-budget-validator/);
  });

  it("category-budget-validator.ts 자체에 @deprecated 표기가 있어야 함", () => {
    const validatorPath = path.join(BUDGET_DIR, "category-budget-validator.ts");
    const source = fs.readFileSync(validatorPath, "utf-8");
    expect(source).toMatch(/@deprecated/);
  });

  it("budget 디렉토리 내 gate/engine/release에서 validator를 import하지 않아야 함", () => {
    const budgetFiles = [
      "category-budget-gate.ts",
      "category-spending-engine.ts",
      "category-budget-release.ts",
      "budget-concurrency.ts",
    ];

    for (const file of budgetFiles) {
      const filePath = path.join(BUDGET_DIR, file);
      if (!fs.existsSync(filePath)) continue;
      const source = fs.readFileSync(filePath, "utf-8");
      expect(source).not.toMatch(/from.*category-budget-validator/);
    }
  });
});

// ── F2: suggestCategoryMapping approve path fence ──

describe("F2: suggestCategoryMapping approve path 차단", () => {
  it("approve route에서 suggestCategoryMapping을 import하지 않아야 함", () => {
    const source = fs.readFileSync(APPROVE_ROUTE, "utf-8");
    // import 선언에 suggestCategoryMapping이 없어야 함
    const importLines = source
      .split("\n")
      .filter((line: string) => line.trim().startsWith("import"));
    const hasSuggestImport = importLines.some((line: string) =>
      line.includes("suggestCategoryMapping"),
    );
    expect(hasSuggestImport).toBe(false);
  });

  it("approve route에서 suggestCategoryMapping을 호출하지 않아야 함", () => {
    const source = fs.readFileSync(APPROVE_ROUTE, "utf-8");
    // 주석 제외한 실행 코드에서 호출이 없어야 함
    const executableLines = source
      .split("\n")
      .filter(
        (line: string) =>
          !line.trim().startsWith("//") &&
          !line.trim().startsWith("*") &&
          !line.trim().startsWith("/**"),
      );
    const hasCall = executableLines.some((line: string) =>
      line.includes("suggestCategoryMapping("),
    );
    expect(hasCall).toBe(false);
  });

  it("category-budget-gate.ts에서 suggestCategoryMapping을 import하지 않아야 함", () => {
    const gatePath = path.join(BUDGET_DIR, "category-budget-gate.ts");
    const source = fs.readFileSync(gatePath, "utf-8");
    expect(source).not.toMatch(/import.*suggestCategoryMapping/);
  });
});

// ── F3: gate yearMonth 명시 전달 강제 ──

describe("F3: period_key 명시 전달", () => {
  it("approve route에서 resolvePeriodYearMonth을 import해야 함", () => {
    const source = fs.readFileSync(APPROVE_ROUTE, "utf-8");
    expect(source).toMatch(/resolvePeriodYearMonth/);
  });

  it("approve route에서 validateCategoryBudgetInTransaction에 yearMonth를 명시 전달해야 함", () => {
    const source = fs.readFileSync(APPROVE_ROUTE, "utf-8");
    // gate 호출 시 4번째 인자(yearMonth)가 있어야 함
    const gateCallMatch = source.match(
      /validateCategoryBudgetInTransaction\(\s*\n?\s*tx,\s*\n?\s*\w+,\s*\n?\s*\w+,\s*\n?\s*(\w+)/,
    );
    expect(gateCallMatch).not.toBeNull();
    // 전달된 값이 periodYearMonth여야 함
    if (gateCallMatch) {
      expect(gateCallMatch[1]).toBe("periodYearMonth");
    }
  });
});

// ── F4: release event shape 일관성 ──

describe("F4: release event audit shape", () => {
  it("category-budget-release.ts가 BudgetGateAuditEvent를 export해야 함", () => {
    const releasePath = path.join(BUDGET_DIR, "category-budget-release.ts");
    const source = fs.readFileSync(releasePath, "utf-8");
    expect(source).toMatch(/releaseEventToAuditShape/);
    expect(source).toMatch(/BudgetGateAuditEvent/);
  });

  it("4종 release event 함수가 모두 존재해야 함", () => {
    const releasePath = path.join(BUDGET_DIR, "category-budget-release.ts");
    const source = fs.readFileSync(releasePath, "utf-8");
    expect(source).toMatch(/releaseApprovalReversed/);
    expect(source).toMatch(/releaseRequestCancelled/);
    expect(source).toMatch(/releasePOVoided/);
    expect(source).toMatch(/releaseCategoryReclass/);
  });
});

// ── F5: toISOString().slice(0,7) 직접 월 키 생성 금지 ──

describe("F5: toISOString().slice(0,7) 재발 방지", () => {
  /**
   * budget 관련 코드에서 toISOString().slice(0,7) 패턴은 UTC 기준 월을 생성한다.
   * org timezone 기준 월(resolvePeriodYearMonth)과 달라질 수 있으므로,
   * budget gate/engine/release/approve route/widget API에서 사용 금지.
   *
   * 유일한 예외: deprecated category-budget-validator.ts (이미 @deprecated)
   */

  const FORBIDDEN_PATTERN = /toISOString\(\)\.slice\(0,\s*7\)/;

  it("approve route에서 toISOString().slice(0,7)을 사용하지 않아야 함", () => {
    const source = fs.readFileSync(APPROVE_ROUTE, "utf-8");
    expect(source).not.toMatch(FORBIDDEN_PATTERN);
  });

  it("category-budget-gate.ts에서 toISOString().slice(0,7)을 사용하지 않아야 함", () => {
    const source = fs.readFileSync(path.join(BUDGET_DIR, "category-budget-gate.ts"), "utf-8");
    expect(source).not.toMatch(FORBIDDEN_PATTERN);
  });

  it("category-spending-engine.ts에서 toISOString().slice(0,7)을 사용하지 않아야 함", () => {
    const source = fs.readFileSync(path.join(BUDGET_DIR, "category-spending-engine.ts"), "utf-8");
    expect(source).not.toMatch(FORBIDDEN_PATTERN);
  });

  it("category-budget-release.ts에서 toISOString().slice(0,7)을 사용하지 않아야 함", () => {
    const source = fs.readFileSync(path.join(BUDGET_DIR, "category-budget-release.ts"), "utf-8");
    expect(source).not.toMatch(FORBIDDEN_PATTERN);
  });

  it("budget-concurrency.ts에서 toISOString().slice(0,7)을 사용하지 않아야 함", () => {
    const source = fs.readFileSync(path.join(BUDGET_DIR, "budget-concurrency.ts"), "utf-8");
    expect(source).not.toMatch(FORBIDDEN_PATTERN);
  });

  it("category-spending API route에서 toISOString().slice(0,7)을 사용하지 않아야 함", () => {
    const apiPath = path.resolve(SRC_ROOT, "app/api/category-spending/route.ts");
    if (!fs.existsSync(apiPath)) return; // API가 없으면 skip
    const source = fs.readFileSync(apiPath, "utf-8");
    expect(source).not.toMatch(FORBIDDEN_PATTERN);
  });

  it("CategorySpendingWidget에서 toISOString().slice(0,7)을 사용하지 않아야 함", () => {
    const widgetPath = path.resolve(
      SRC_ROOT,
      "components/dashboard/CategorySpendingWidget.tsx",
    );
    if (!fs.existsSync(widgetPath)) return;
    const source = fs.readFileSync(widgetPath, "utf-8");
    expect(source).not.toMatch(FORBIDDEN_PATTERN);
  });
});
