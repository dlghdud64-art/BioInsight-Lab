// @ts-nocheck — vitest/prisma schema drift, 임시 우회
/**
 * Budget Lifecycle Wiring — 계약 테스트
 *
 * Budget Lifecycle Completion 배치의 5종 흐름을 계약 수준에서 검증한다.
 * 파일 내용 분석 기반 (런타임 import 없이).
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "../../..");

function readSrc(relPath: string): string {
  const full = resolve(ROOT, relPath);
  if (!existsSync(full)) {
    throw new Error(`File not found: ${full}`);
  }
  return readFileSync(full, "utf-8");
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("Budget Lifecycle Wiring 계약 테스트\n");

// ── BudgetEventKey 계약 ──

console.log("  === BudgetEventKey 계약 ===");

test("K1: buildBudgetEventKey — suffix가 string|number 허용", () => {
  const content = readSrc("lib/budget/budget-concurrency.ts");
  assert.ok(content.includes("suffix: string | number"), "suffix should accept string|number");
});

test("K2: buildBudgetEventKey — key 형식에 suffix 포함", () => {
  const content = readSrc("lib/budget/budget-concurrency.ts");
  assert.ok(content.includes("${suffix}"), "key format should include suffix");
});

// ── Approve route — reserve 기록 ──

console.log("\n  === Approve route reserve 기록 ===");

test("W5: approve route — recordBudgetEventIdempotent으로 reserve 기록", () => {
  const content = readSrc("app/api/request/[id]/approve/route.ts");
  assert.ok(content.includes("recordBudgetEventIdempotent"), "should record reserve BudgetEvent");
  assert.ok(content.includes("approval_reserved"), "should use 'approval_reserved' eventType");
  assert.ok(content.includes("buildBudgetEventKey"), "should build budget event key");
});

test("W5a: approve route — categoryId를 key suffix로 사용", () => {
  const content = readSrc("app/api/request/[id]/approve/route.ts");
  assert.ok(content.includes("decision.categoryId"), "should use categoryId per decision");
  assert.ok(
    content.includes('"approval_reserved"') && content.includes("decision.categoryId"),
    "should include categoryId in budgetEventKey",
  );
});

// ── Release 함수 — 원본 reserve 참조 ──

console.log("\n  === Release 함수 원본 reserve 참조 ===");

test("R1: release 모듈이 resolvePeriodYearMonth를 import하지 않음", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  assert.ok(!content.includes("resolvePeriodYearMonth"),
    "release module should NOT import resolvePeriodYearMonth");
});

test("R2: lookupOriginalReserves 함수가 approval_reserved 이벤트를 조회", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  assert.ok(content.includes("lookupOriginalReserves"), "should have lookupOriginalReserves");
  assert.ok(content.includes('"approval_reserved"'), "should query approval_reserved events");
});

test("R3: release BudgetEvent amount는 음수 (해제)", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  assert.ok(content.includes("-reserve.amount"), "release amount should be negative");
});

test("R4: NegativeCommittedSpendError 정의됨", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  assert.ok(content.includes("class NegativeCommittedSpendError extends Error"), "should define NegativeCommittedSpendError");
  assert.ok(content.includes("__negativeCommitted"), "should have __negativeCommitted flag");
});

test("R5: releaseApprovalReversed — orgTimezone 파라미터 없음", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  // releaseApprovalReversed 함수의 params 블록에서 orgTimezone 없어야 함
  const fnBlock = content.slice(
    content.indexOf("export async function releaseApprovalReversed"),
    content.indexOf("export async function releaseRequestCancelled"),
  );
  assert.ok(!fnBlock.includes("orgTimezone"), "releaseApprovalReversed should not take orgTimezone");
});

test("R6: releaseRequestCancelled — orgTimezone 파라미터 없음", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  const fnBlock = content.slice(
    content.indexOf("export async function releaseRequestCancelled"),
    content.indexOf("export async function releasePOVoided"),
  );
  assert.ok(!fnBlock.includes("orgTimezone"), "releaseRequestCancelled should not take orgTimezone");
});

test("R7: releasePOVoided — requestId 파라미터 있음", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  const fnBlock = content.slice(
    content.indexOf("export async function releasePOVoided"),
    content.indexOf("export async function releaseCategoryReclass"),
  );
  assert.ok(fnBlock.includes("requestId"), "releasePOVoided should take requestId");
});

test("R8: releaseCategoryReclass — requestId 파라미터 있음", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  const fnBlock = content.slice(
    content.indexOf("export async function releaseCategoryReclass"),
  );
  assert.ok(fnBlock.includes("requestId"), "releaseCategoryReclass should take requestId");
});

test("R9: 음수 guard — preRelease < amount 체크", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  assert.ok(content.includes("preRelease < reserve.amount") || content.includes("preRelease < amount"),
    "should check for negative committed spend before release");
  assert.ok(content.includes("NegativeCommittedSpendError"),
    "should throw NegativeCommittedSpendError");
});

// ── Route wiring 계약 ──

console.log("\n  === Route wiring 계약 ===");

test("W1: request/[id]/cancel route 존재 + release 연결", () => {
  const content = readSrc("app/api/request/[id]/cancel/route.ts");
  assert.ok(content.includes("releaseRequestCancelled"), "should call releaseRequestCancelled");
  assert.ok(content.includes("withSerializableBudgetTx"), "should use SERIALIZABLE tx");
  assert.ok(content.includes("NegativeCommittedSpendError"), "should handle NegativeCommittedSpendError");
  assert.ok(content.includes("purchase_request_cancel"), "should enforce purchase_request_cancel action");
});

test("W2: request/[id]/reverse route 존재 + release 연결", () => {
  const content = readSrc("app/api/request/[id]/reverse/route.ts");
  assert.ok(content.includes("releaseApprovalReversed"), "should call releaseApprovalReversed");
  assert.ok(content.includes("withSerializableBudgetTx"), "should use SERIALIZABLE tx");
  assert.ok(content.includes("purchase_request_reverse"), "should enforce purchase_request_reverse action");
});

test("W3: purchases/[id]/reclass route 존재 + release 연결", () => {
  const content = readSrc("app/api/purchases/[id]/reclass/route.ts");
  assert.ok(content.includes("releaseCategoryReclass"), "should call releaseCategoryReclass");
  assert.ok(content.includes("withSerializableBudgetTx"), "should use SERIALIZABLE tx");
  assert.ok(content.includes("purchase_record_reclass"), "should enforce purchase_record_reclass action");
});

test("W4: admin/orders/[id]/status — CANCELLED에 releasePOVoided 연결", () => {
  const content = readSrc("app/api/admin/orders/[id]/status/route.ts");
  assert.ok(content.includes("releasePOVoided"), "should call releasePOVoided on CANCELLED");
  assert.ok(content.includes("withSerializableBudgetTx"), "should use SERIALIZABLE tx for CANCELLED");
  assert.ok(content.includes("NegativeCommittedSpendError"), "should handle NegativeCommittedSpendError");
});

// ── Lifecycle grammar 연속성 ──

console.log("\n  === Lifecycle grammar 연속성 ===");

test("G1: cancel은 APPROVED 상태만 허용 → CANCELLED", () => {
  const content = readSrc("app/api/request/[id]/cancel/route.ts");
  assert.ok(content.includes("PurchaseRequestStatus.APPROVED"), "checks for APPROVED status");
  assert.ok(content.includes("CANCELLED"), "transitions to CANCELLED");
});

test("G2: reverse는 APPROVED → PENDING", () => {
  const content = readSrc("app/api/request/[id]/reverse/route.ts");
  assert.ok(content.includes("PurchaseRequestStatus.APPROVED"), "checks for APPROVED status");
  assert.ok(content.includes("PurchaseRequestStatus.PENDING"), "transitions to PENDING");
});

test("G3: reverse는 Order가 ORDERED 이외 상태이면 차단", () => {
  const content = readSrc("app/api/request/[id]/reverse/route.ts");
  assert.ok(content.includes('order.status !== "ORDERED"'), "blocks if order already progressed");
});

test("G4: cancel 시 연결된 Order도 CANCELLED", () => {
  const content = readSrc("app/api/request/[id]/cancel/route.ts");
  assert.ok(content.includes('status: "CANCELLED"'), "also cancels linked order");
});

test("G5: reclass는 동일 카테고리 시 no-op", () => {
  const content = readSrc("app/api/purchases/[id]/reclass/route.ts");
  assert.ok(content.includes("normalizedCategoryId === toCategoryId"), "no-op for same category");
});

test("G6: reverse 시 approverId, approvedAt, orderId null 초기화", () => {
  const content = readSrc("app/api/request/[id]/reverse/route.ts");
  assert.ok(content.includes("approverId: null"), "clears approverId");
  assert.ok(content.includes("approvedAt: null"), "clears approvedAt");
  assert.ok(content.includes("orderId: null"), "clears orderId");
});

// ── Security guard 계약 ──

console.log("\n  === Security guard 계약 ===");

test("S1: 새 action 타입 — authorization guard에 등록", () => {
  const content = readSrc("lib/security/server-authorization-guard.ts");
  assert.ok(content.includes("purchase_request_cancel"), "cancel action registered");
  assert.ok(content.includes("purchase_request_reverse"), "reverse action registered");
  assert.ok(content.includes("purchase_record_reclass"), "reclass action registered");
});

test("S2: 역할 매핑 정확", () => {
  const content = readSrc("lib/security/server-authorization-guard.ts");
  assert.ok(content.includes("purchase_request_cancel: ['approver', 'ops_admin']"), "cancel: approver+");
  assert.ok(content.includes("purchase_request_reverse: ['approver', 'ops_admin']"), "reverse: approver+");
  assert.ok(content.includes("purchase_record_reclass: ['buyer', 'approver', 'ops_admin']"), "reclass: buyer+");
});

test("S3: purchase_record targetEntityType — enforcement middleware 등록", () => {
  const content = readSrc("lib/security/server-enforcement-middleware.ts");
  assert.ok(content.includes("'purchase_record'"), "purchase_record in enforcement middleware");
});

test("S4: purchase_record targetEntityType — authorization guard 등록", () => {
  const content = readSrc("lib/security/server-authorization-guard.ts");
  assert.ok(content.includes("'purchase_record'"), "purchase_record in authorization guard");
});

// ── Audit 계약 ──

console.log("\n  === Audit 계약 ===");

test("A1: cancel route — enforcement.complete에 budgetRelease 포함", () => {
  const content = readSrc("app/api/request/[id]/cancel/route.ts");
  assert.ok(content.includes("releaseEventToAuditShape"), "audit includes release event");
  assert.ok(content.includes("enforcement.complete"), "calls enforcement.complete");
});

test("A2: reverse route — enforcement.complete에 budgetRelease 포함", () => {
  const content = readSrc("app/api/request/[id]/reverse/route.ts");
  assert.ok(content.includes("releaseEventToAuditShape"), "audit includes release event");
  assert.ok(content.includes("enforcement.complete"), "calls enforcement.complete");
});

test("A3: order cancel — enforcement.complete에 budgetRelease 포함", () => {
  const content = readSrc("app/api/admin/orders/[id]/status/route.ts");
  assert.ok(content.includes("releaseEventToAuditShape"), "audit includes release event");
});

test("A4: reclass route — enforcement.complete에 budgetReclass 포함", () => {
  const content = readSrc("app/api/purchases/[id]/reclass/route.ts");
  assert.ok(content.includes("releaseEventToAuditShape"), "audit includes reclass event");
  assert.ok(content.includes("enforcement.complete"), "calls enforcement.complete");
});

// ── 금지 사항 확인 ──

console.log("\n  === 금지 사항 확인 ===");

test("P1: approve route에서 suggestCategoryMapping import 없음 (주석 제외)", () => {
  const content = readSrc("app/api/request/[id]/approve/route.ts");
  // import 문에 suggestCategoryMapping이 없어야 함 (주석은 OK)
  const importLines = content.split("\n").filter(
    (l) => l.trimStart().startsWith("import") && l.includes("suggestCategoryMapping"),
  );
  assert.equal(importLines.length, 0, "no suggestCategoryMapping import in approve route");
  // 함수 호출도 없어야 함 (주석 제외)
  const callLines = content.split("\n").filter(
    (l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//") && l.includes("suggestCategoryMapping("),
  );
  assert.equal(callLines.length, 0, "no suggestCategoryMapping call in approve route");
});

test("P2: release에서 optimistic unlock 없음 (실제 계산만)", () => {
  const content = readSrc("lib/budget/category-budget-release.ts");
  assert.ok(!content.includes("optimistic"), "no optimistic unlock in release");
});

// ── Summary ──

console.log("\n" + "=".repeat(50));
console.log(`총 ${passed + failed}개 중 ${passed}개 통과, ${failed}개 실패`);
if (failed > 0) process.exitCode = 1;
