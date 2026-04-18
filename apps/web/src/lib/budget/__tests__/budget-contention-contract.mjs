/**
 * Budget Contention Test — 계약 검증 (네트워크 불필요)
 *
 * budget-postgresql-contention.mjs가 올바른 구조를 가지는지 파일 분석으로 검증.
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const contentionScript = readFileSync(resolve(__dir, "budget-postgresql-contention.mjs"), "utf-8");
const releaseModule = readFileSync(resolve(__dir, "../category-budget-release.ts"), "utf-8");
const concurrencyModule = readFileSync(resolve(__dir, "../budget-concurrency.ts"), "utf-8");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

console.log("Budget Contention Test 계약 검증\n");

// ── 테스트 스크립트 구조 ──

console.log("  === 테스트 스크립트 구조 ===");

test("S1: DIRECT_URL 체크 — pgbouncer(6543) 경고", () => {
  assert.ok(contentionScript.includes(":6543"), "should warn about pgbouncer port");
});

test("S2: SERIALIZABLE isolation level 사용", () => {
  assert.ok(contentionScript.includes('"Serializable"'), "should use Serializable isolation");
});

test("S3: isSerializationFailure — P2034 + 40001 감지", () => {
  assert.ok(contentionScript.includes('"P2034"'), "detects P2034");
  assert.ok(contentionScript.includes('"40001"'), "detects 40001");
});

test("S4: bounded retry — 지수 백오프 + jitter", () => {
  assert.ok(contentionScript.includes("Math.pow(2, attempt)"), "exponential backoff");
  assert.ok(contentionScript.includes("Math.random()"), "jitter");
});

test("S5: budgetEventKey unique 위반 — P2002 catch", () => {
  assert.ok(contentionScript.includes('"P2002"'), "catches P2002");
  assert.ok(contentionScript.includes("idempotent_skip"), "tracks idempotent skip");
});

// ── 5개 시나리오 존재 ──

console.log("\n  === 5개 시나리오 ===");

test("C1: testC1 (concurrent approve) 존재", () => {
  assert.ok(contentionScript.includes("async function testC1"), "testC1 defined");
  assert.ok(contentionScript.includes("hard_stop"), "checks budget hard_stop");
  assert.ok(contentionScript.includes("approval_reserved"), "records approval_reserved");
});

test("C2: testC2 (approve + cancel race) 존재", () => {
  assert.ok(contentionScript.includes("async function testC2"), "testC2 defined");
  assert.ok(contentionScript.includes("request_cancel_released"), "records cancel release");
  assert.ok(contentionScript.includes("Promise.allSettled"), "concurrent execution");
});

test("C3: testC3 (cancel duplicate replay) 존재", () => {
  assert.ok(contentionScript.includes("async function testC3"), "testC3 defined");
  assert.ok(contentionScript.includes("cancelOnce"), "duplicate cancel function");
});

test("C4: testC4 (retry exhausted) 존재", () => {
  assert.ok(contentionScript.includes("async function testC4"), "testC4 defined");
  assert.ok(contentionScript.includes("exhausted"), "tracks exhaustion");
});

test("C5: testC5 (budgetEventKey unique) 존재", () => {
  assert.ok(contentionScript.includes("async function testC5"), "testC5 defined");
  assert.ok(contentionScript.includes("P2002"), "catches unique violation");
});

// ── 계측 ──

console.log("\n  === 계측 필수값 ===");

test("T1: budget_tx_conflict_count 추적", () => {
  assert.ok(contentionScript.includes("budget_tx_conflict_count"), "tracked");
});

test("T2: budget_tx_retry_count 추적", () => {
  assert.ok(contentionScript.includes("budget_tx_retry_count"), "tracked");
});

test("T3: budget_tx_exhausted_retries 추적", () => {
  assert.ok(contentionScript.includes("budget_tx_exhausted_retries"), "tracked");
});

test("T4: budget_event_idempotent_skip_count 추적", () => {
  assert.ok(contentionScript.includes("budget_event_idempotent_skip_count"), "tracked");
});

test("T5: negative_committed_spend_block_count 추적", () => {
  assert.ok(contentionScript.includes("negative_committed_spend_block_count"), "tracked");
});

// ── 정리 ──

console.log("\n  === 정리 ===");

test("CL1: teardown 함수에서 테스트 데이터 정리", () => {
  assert.ok(contentionScript.includes("async function teardown"), "teardown defined");
  assert.ok(contentionScript.includes("deleteMany"), "deletes test data");
});

test("CL2: 테스트 데이터 prefix 격리", () => {
  assert.ok(contentionScript.includes("__test_ct_"), "uses unique prefix");
  assert.ok(contentionScript.includes("Date.now()"), "timestamp in prefix");
});

// ── Release 모듈 — 원본 reserve 참조 유지 ──

console.log("\n  === Release 모듈 정합성 ===");

test("RM1: lookupOriginalReserves가 approval_reserved 조회", () => {
  assert.ok(releaseModule.includes("lookupOriginalReserves"), "function exists");
  assert.ok(releaseModule.includes('"approval_reserved"'), "queries approval_reserved");
});

test("RM2: NegativeCommittedSpendError 정의", () => {
  assert.ok(releaseModule.includes("class NegativeCommittedSpendError"), "class defined");
});

test("RM3: recordBudgetEventIdempotent 호출", () => {
  assert.ok(releaseModule.includes("recordBudgetEventIdempotent"), "called in release functions");
});

test("RM4: resolvePeriodYearMonth import 없음", () => {
  assert.ok(!releaseModule.includes("resolvePeriodYearMonth"), "no yearMonth re-derivation");
});

// ── Concurrency 모듈 정합성 ──

console.log("\n  === Concurrency 모듈 정합성 ===");

test("CM1: buildBudgetEventKey suffix — string|number", () => {
  assert.ok(concurrencyModule.includes("suffix: string | number"), "accepts both types");
});

test("CM2: SERIALIZABLE isolation + bounded retry", () => {
  assert.ok(concurrencyModule.includes("Serializable"), "uses Serializable");
  assert.ok(concurrencyModule.includes("MAX_RETRIES"), "has max retries");
});

test("CM3: telemetry 5종 카운터", () => {
  assert.ok(concurrencyModule.includes("budget_tx_total"), "total counter");
  assert.ok(concurrencyModule.includes("budget_tx_retry_count"), "retry counter");
  assert.ok(concurrencyModule.includes("budget_tx_conflict_count"), "conflict counter");
  assert.ok(concurrencyModule.includes("budget_tx_exhausted"), "exhausted counter");
  assert.ok(concurrencyModule.includes("budget_tx_success"), "success counter");
});

// ── Summary ──

console.log("\n" + "=".repeat(50));
console.log(`총 ${passed + failed}개 중 ${passed}개 통과, ${failed}개 실패`);
if (failed > 0) process.exitCode = 1;
