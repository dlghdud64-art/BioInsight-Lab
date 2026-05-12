/**
 * §11.228 #quote-management-v2-phase-c1 — 호영님 v2 #20 일괄 처리 강화
 *
 * 호영님 v2 spec sheet (2026-05-11):
 *   #20 일괄 처리 강화 — 발송만 → 리마인더 + 상태 변경 추가
 *
 * canonical truth lock:
 *   - 기존 endpoint 재사용 (PATCH /api/quotes/[id]/status, POST /api/quotes/[id]/vendor-requests)
 *   - quote.status (DB) / quote.responses (DB) 변경 0
 *   - BatchActionBar same-canvas sticky 유지
 *   - §11.217 Phase 3 (BatchActionBar / BatchDispatchSheet) 보존
 *   - §11.225 (organizationVendorProducts forward) 보존
 *   - §11.227 (viewMode default table / sortState / 미니 타임라인) 보존
 *
 * 호영님 (a) 분리 결정 (2026-05-12):
 *   - BatchReminderSheet / BatchStatusChangeSheet 2 file 신설
 *   - BatchDispatchSheet mode prop 통합 거부
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const BATCH_ACTION_BAR_PATH = resolve(__dirname, "../../../components/quotes/dispatch/batch-action-bar.tsx");
const BATCH_REMINDER_SHEET_PATH = resolve(__dirname, "../../../components/quotes/dispatch/batch-reminder-sheet.tsx");
const BATCH_STATUS_CHANGE_SHEET_PATH = resolve(__dirname, "../../../components/quotes/dispatch/batch-status-change-sheet.tsx");

const page = readFileSync(PAGE_PATH, "utf8");
const batchActionBar = readFileSync(BATCH_ACTION_BAR_PATH, "utf8");

describe("§11.228 #1 — BatchActionBar 3 mutation CTA + 분리 라벨", () => {
  it("BatchActionBarProps — onReminderStart prop 정의", () => {
    expect(batchActionBar).toMatch(/onReminderStart\s*:\s*\(\s*\)\s*=>\s*void/);
  });

  it("BatchActionBarProps — onStatusChangeStart prop 정의", () => {
    expect(batchActionBar).toMatch(/onStatusChangeStart\s*:\s*\(\s*\)\s*=>\s*void/);
  });

  it("BatchActionBarProps — reminderEligibleCount prop 정의 (responseCount === 0 quote N건)", () => {
    expect(batchActionBar).toMatch(/reminderEligibleCount\s*:\s*number/);
  });

  it("BatchActionBar component — 'onReminderStart' / 'onStatusChangeStart' destructure", () => {
    expect(batchActionBar).toMatch(/onReminderStart[\s\S]{0,200}onStatusChangeStart|onStatusChangeStart[\s\S]{0,200}onReminderStart/);
  });

  it("BatchActionBar — '리마인더' CTA 라벨 노출", () => {
    expect(batchActionBar).toMatch(/리마인더/);
  });

  it("BatchActionBar — '상태 변경' CTA 라벨 노출", () => {
    expect(batchActionBar).toMatch(/상태 변경/);
  });

  it("BatchActionBar — '회신 대기 K건' 분리 라벨 노출 (reminderEligibleCount > 0)", () => {
    expect(batchActionBar).toMatch(/회신 대기/);
  });

  it("BatchActionBar — 리마인더 CTA disabled 분기 (reminderEligibleCount === 0)", () => {
    // disabled={reminderEligibleCount === 0} 또는 reminderEligibleCount === 0 ? ... : ...
    expect(batchActionBar).toMatch(/reminderEligibleCount\s*===\s*0|reminderEligibleCount\s*<\s*1/);
  });

  it("BatchActionBar — 검토 시작 (기존) CTA 보존 (§11.217 Phase 3 invariant)", () => {
    expect(batchActionBar).toMatch(/검토 시작/);
  });

  it("BatchActionBar — onClearSelection (기존) prop 보존", () => {
    expect(batchActionBar).toMatch(/onClearSelection/);
  });
});

describe("§11.228 #2 — BatchReminderSheet 신설 (responseCount === 0 filter)", () => {
  it("file exists — batch-reminder-sheet.tsx", () => {
    expect(existsSync(BATCH_REMINDER_SHEET_PATH)).toBe(true);
  });

  it("export BatchReminderSheet component", () => {
    const src = readFileSync(BATCH_REMINDER_SHEET_PATH, "utf8");
    expect(src).toMatch(/export\s+(function|const)\s+BatchReminderSheet/);
  });

  it("Props — open / onOpenChange / selectedQuotes / organizationVendors / onSuccess", () => {
    const src = readFileSync(BATCH_REMINDER_SHEET_PATH, "utf8");
    expect(src).toMatch(/open\s*:\s*boolean/);
    expect(src).toMatch(/onOpenChange\s*:\s*\(\s*open\s*:\s*boolean\s*\)\s*=>\s*void/);
    expect(src).toMatch(/selectedQuotes\s*:/);
    expect(src).toMatch(/organizationVendors\?\s*:|organizationVendors\s*:/);
    expect(src).toMatch(/onSuccess\s*:\s*\(\s*\)\s*=>\s*void/);
  });

  it("responseCount === 0 filter — eligibleQuotes 또는 reminderTargets", () => {
    const src = readFileSync(BATCH_REMINDER_SHEET_PATH, "utf8");
    // (a.length ?? 0) === 0 또는 responses === 0 또는 responseCount === 0 패턴
    expect(src).toMatch(/responses[\s\S]{0,100}length[\s\S]{0,30}===\s*0|responseCount\s*===\s*0|\.length\s*===\s*0/);
  });

  it("vendor-requests POST endpoint 재사용 — csrfFetch + vendor-requests", () => {
    const src = readFileSync(BATCH_REMINDER_SHEET_PATH, "utf8");
    expect(src).toMatch(/csrfFetch[\s\S]{0,200}vendor-requests/);
    expect(src).toMatch(/method\s*:\s*["']POST["']/);
  });

  it("Promise.allSettled (partial failure pattern §11.217 lineage)", () => {
    const src = readFileSync(BATCH_REMINDER_SHEET_PATH, "utf8");
    expect(src).toMatch(/Promise\.allSettled/);
  });

  it("Dialog UI — @/components/ui/dialog 사용", () => {
    const src = readFileSync(BATCH_REMINDER_SHEET_PATH, "utf8");
    expect(src).toMatch(/from\s+["']@\/components\/ui\/dialog["']/);
  });

  it("리마인더 라벨 노출 (sheet title / CTA)", () => {
    const src = readFileSync(BATCH_REMINDER_SHEET_PATH, "utf8");
    expect(src).toMatch(/리마인더/);
  });

  it("cluster trace marker (§11.228)", () => {
    const src = readFileSync(BATCH_REMINDER_SHEET_PATH, "utf8");
    expect(src).toMatch(/§11\.228|#quote-management-v2-phase-c1|일괄 처리 강화/);
  });
});

describe("§11.228 #3 — BatchStatusChangeSheet 신설 (PATCH status N회)", () => {
  it("file exists — batch-status-change-sheet.tsx", () => {
    expect(existsSync(BATCH_STATUS_CHANGE_SHEET_PATH)).toBe(true);
  });

  it("export BatchStatusChangeSheet component", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/export\s+(function|const)\s+BatchStatusChangeSheet/);
  });

  it("Props — open / onOpenChange / selectedQuotes / onSuccess", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/open\s*:\s*boolean/);
    expect(src).toMatch(/onOpenChange\s*:\s*\(\s*open\s*:\s*boolean\s*\)\s*=>\s*void/);
    expect(src).toMatch(/selectedQuotes\s*:/);
    expect(src).toMatch(/onSuccess\s*:\s*\(\s*\)\s*=>\s*void/);
  });

  it("status 선택 useState — 새 status 변수", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/useState[\s\S]{0,200}(targetStatus|newStatus|selectedStatus)/);
  });

  it("PATCH /api/quotes/[id]/status endpoint 호출 (csrfFetch)", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/csrfFetch[\s\S]{0,300}\/status/);
    expect(src).toMatch(/method\s*:\s*["']PATCH["']/);
  });

  it("Promise.allSettled (partial failure pattern)", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/Promise\.allSettled/);
  });

  it("status option 라벨 — '완료' / '취소' 최소 2개", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/완료/);
    expect(src).toMatch(/취소/);
  });

  it("status enum 정합 — 'COMPLETED' / 'CANCELLED' 최소 2개", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/COMPLETED/);
    expect(src).toMatch(/CANCELLED/);
  });

  it("결과 통계 — successCount / failCount 또는 success.*fail 변수", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/successCount|failCount|성공[\s\S]{0,80}실패|실패[\s\S]{0,80}성공/);
  });

  it("Dialog UI — @/components/ui/dialog 사용", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/from\s+["']@\/components\/ui\/dialog["']/);
  });

  it("상태 변경 라벨 노출 (sheet title / CTA)", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/상태 변경/);
  });

  it("cluster trace marker (§11.228)", () => {
    const src = readFileSync(BATCH_STATUS_CHANGE_SHEET_PATH, "utf8");
    expect(src).toMatch(/§11\.228|#quote-management-v2-phase-c1|일괄 처리 강화/);
  });
});

describe("§11.228 #4 — page.tsx wiring + invariant 보존", () => {
  it("BatchReminderSheet import", () => {
    expect(page).toMatch(/BatchReminderSheet/);
  });

  it("BatchStatusChangeSheet import", () => {
    expect(page).toMatch(/BatchStatusChangeSheet/);
  });

  it("batchReminderOpen useState — sheet state", () => {
    expect(page).toMatch(/batchReminderOpen|setBatchReminderOpen/);
  });

  it("batchStatusChangeOpen useState — sheet state", () => {
    expect(page).toMatch(/batchStatusChangeOpen|setBatchStatusChangeOpen/);
  });

  it("BatchActionBar onReminderStart prop forward", () => {
    expect(page).toMatch(/BatchActionBar[\s\S]{0,800}onReminderStart=/);
  });

  it("BatchActionBar onStatusChangeStart prop forward", () => {
    expect(page).toMatch(/BatchActionBar[\s\S]{0,800}onStatusChangeStart=/);
  });

  it("BatchActionBar reminderEligibleCount prop forward", () => {
    expect(page).toMatch(/BatchActionBar[\s\S]{0,800}reminderEligibleCount=/);
  });

  it("BatchReminderSheet render — onSuccess + organizationVendors forward", () => {
    expect(page).toMatch(/<BatchReminderSheet[\s\S]{0,600}onSuccess=/);
    expect(page).toMatch(/<BatchReminderSheet[\s\S]{0,800}organizationVendors=/);
  });

  it("BatchStatusChangeSheet render — onSuccess forward", () => {
    expect(page).toMatch(/<BatchStatusChangeSheet[\s\S]{0,600}onSuccess=/);
  });

  it("§11.217 Phase 3 invariant — BatchActionBar onReviewStart / BatchDispatchSheet 보존", () => {
    expect(page).toMatch(/onReviewStart=/);
    expect(page).toMatch(/<BatchDispatchSheet/);
  });

  it("§11.225 invariant — organizationVendorProducts 3 caller forward 보존", () => {
    expect(page).toMatch(/getQuoteDispatchPreflight\([\s\S]{0,200}organizationVendorProducts/);
  });

  it("§11.227 invariant — viewMode default table + sortState 보존", () => {
    expect(page).toMatch(/sortState|setSortState/);
    expect(page).toMatch(/aria-pressed=\{viewMode === "table"\}/);
  });

  it("cluster trace marker (§11.228)", () => {
    expect(page).toMatch(/§11\.228|#quote-management-v2-phase-c1|일괄 처리 강화/);
  });
});
