/**
 * Budget PostgreSQL Contention Validation
 *
 * 실 PostgreSQL에서 SERIALIZABLE 충돌, unique 제약, retry, telemetry를 검증한다.
 *
 * ⚠️ 필수 조건:
 *   - DIRECT_URL (port 5432, non-pgbouncer) 사용. pgbouncer(6543)는 SERIALIZABLE 미지원.
 *   - Prisma Client가 현재 플랫폼용으로 generate 되어 있어야 함.
 *   - BudgetEvent 테이블이 DB에 존재해야 함 (prisma db push 또는 migration 완료).
 *
 * 실행 (apps/web 디렉토리에서):
 *   DIRECT_URL="postgresql://...@...:5432/postgres?sslmode=require" \
 *   DATABASE_URL="$DIRECT_URL" \
 *   node src/lib/budget/__tests__/budget-postgresql-contention.mjs
 *
 * 또는 PowerShell (Windows):
 *   $env:DIRECT_URL="postgresql://...@...:5432/postgres?sslmode=require"
 *   $env:DATABASE_URL=$env:DIRECT_URL
 *   node src/lib/budget/__tests__/budget-postgresql-contention.mjs
 *
 * 완료 기준 (5개):
 *   1. concurrent approve: 한도를 넘기는 동시 2건 → 최대 1건 통과, committed ≤ 한도
 *   2. approve+cancel race: 최종 잔액 ≥ 0 && ≤ 한도
 *   3. cancel duplicate replay: BudgetEvent 정확히 1개만 기록, 나머지 idempotent skip
 *   4. retry exhausted: telemetry.exhausted 카운터 증가 + P2034 에러 식별 가능
 *   5. budgetEventKey unique: P2002 catch + DB에 1개만 존재
 *
 * 계측 필수값:
 *   budget_tx_conflict_count, budget_tx_retry_count, budget_tx_exhausted_retries,
 *   budget_event_idempotent_skip_count, negative_committed_spend_block_count
 */

import { PrismaClient } from "@prisma/client";

const DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!DIRECT_URL) { console.error("DIRECT_URL or DATABASE_URL required"); process.exit(1); }
if (DIRECT_URL.includes(":6543")) {
  console.warn("⚠️ pgbouncer URL(6543) detected — SERIALIZABLE may not work. Use DIRECT_URL (port 5432).");
}

const db = new PrismaClient({ datasourceUrl: DIRECT_URL, log: [] });

const TEST_PREFIX = `__test_ct_${Date.now()}`;
const TEST_ORG_ID = `${TEST_PREFIX}_org`;

const results = [];
const telemetry = {
  budget_tx_conflict_count: 0,
  budget_tx_retry_count: 0,
  budget_tx_exhausted_retries: 0,
  budget_event_idempotent_skip_count: 0,
  negative_committed_spend_block_count: 0,
};

function isSerializationFailure(error) {
  if (!error || typeof error !== "object") return false;
  if (error.code === "P2034") return true;
  if (error.code === "40001") return true;
  if (error.meta?.code === "40001") return true;
  return false;
}

async function withSerializableRetry(fn, maxRetries = 3, label = "test_tx") {
  let retries = 0, conflicts = 0;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await db.$transaction(fn, { isolationLevel: "Serializable", timeout: 15000 });
      return { result, retries, conflicts };
    } catch (error) {
      if (isSerializationFailure(error)) {
        conflicts++; retries++;
        telemetry.budget_tx_conflict_count++;
        telemetry.budget_tx_retry_count++;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt) + Math.random() * 50));
          continue;
        }
        telemetry.budget_tx_exhausted_retries++;
      }
      throw error;
    }
  }
  throw new Error("unreachable");
}

// ── Setup / Teardown ──

async function setup() {
  console.log(`\n🔧 Setup: prefix=${TEST_PREFIX}\n`);
  await db.organization.create({
    data: { id: TEST_ORG_ID, name: `${TEST_PREFIX}_org`, timezone: "Asia/Seoul" },
  });
  await db.spendingCategory.create({
    data: { id: `${TEST_PREFIX}_cat`, organizationId: TEST_ORG_ID, name: "Reagents", displayName: "시약류" },
  });
  await db.categoryBudget.create({
    data: {
      organizationId: TEST_ORG_ID, categoryId: `${TEST_PREFIX}_cat`, yearMonth: "2026-04",
      amount: 100000, warningPercent: 70, softLimitPercent: 90, hardStopPercent: 100, isActive: true,
    },
  });
  console.log("  ✓ Test data created\n");
}

async function teardown() {
  console.log(`\n🧹 Teardown\n`);
  try {
    await db.budgetEvent.deleteMany({ where: { organizationId: TEST_ORG_ID } });
    await db.purchaseRecord.deleteMany({ where: { scopeKey: TEST_ORG_ID } });
    await db.categoryBudget.deleteMany({ where: { organizationId: TEST_ORG_ID } });
    await db.spendingCategory.deleteMany({ where: { organizationId: TEST_ORG_ID } });
    await db.organization.delete({ where: { id: TEST_ORG_ID } });
    console.log("  ✓ Cleanup complete\n");
  } catch (err) { console.warn("  ⚠ Cleanup:", err.message); }
  await db.$disconnect();
}

// ── C1: Concurrent Approve ──

async function testC1() {
  const name = "C1: concurrent approve — 동시 2건(각 60k), 한도 100k, 최대 1건 통과";
  console.log(`  [${name}]`);
  const catId = `${TEST_PREFIX}_cat`;

  const approve = async (reqId, amount) => withSerializableRetry(async (tx) => {
    const ms = new Date(2026, 3, 1), me = new Date(2026, 4, 1);
    const rows = await tx.purchaseRecord.groupBy({
      by: ["normalizedCategoryId"],
      where: { scopeKey: TEST_ORG_ID, normalizedCategoryId: catId, purchasedAt: { gte: ms, lt: me } },
      _sum: { amount: true },
    });
    const cur = rows[0]?._sum?.amount ?? 0;
    const budget = await tx.categoryBudget.findFirst({
      where: { organizationId: TEST_ORG_ID, categoryId: catId, yearMonth: "2026-04", isActive: true },
    });
    if (budget && ((cur + amount) / budget.amount) * 100 >= budget.hardStopPercent) {
      return { approved: false, reason: "hard_stop", cur };
    }
    await tx.purchaseRecord.create({
      data: { scopeKey: TEST_ORG_ID, purchasedAt: new Date(2026, 3, 14), vendorName: `${TEST_PREFIX}_v`,
        itemName: `${TEST_PREFIX}_c1_${reqId}`, qty: 1, amount, normalizedCategoryId: catId },
    });
    const ek = `${TEST_ORG_ID}:${reqId}:approval_reserved:${catId}`;
    try {
      await tx.budgetEvent.create({
        data: { organizationId: TEST_ORG_ID, budgetEventKey: ek, eventType: "approval_reserved",
          sourceEntityType: "purchase_request", sourceEntityId: reqId, categoryId: catId,
          yearMonth: "2026-04", amount, preCommitted: cur, postCommitted: cur + amount,
          executedBy: `${TEST_PREFIX}_u` },
      });
    } catch (err) {
      if (err.code === "P2002") { telemetry.budget_event_idempotent_skip_count++; return { approved: false, reason: "idempotent" }; }
      throw err;
    }
    return { approved: true, cur, projected: cur + amount };
  });

  const [r1, r2] = await Promise.allSettled([
    approve(`${TEST_PREFIX}_r1`, 60000),
    approve(`${TEST_PREFIX}_r2`, 60000),
  ]);
  const o1 = r1.status === "fulfilled" ? r1.value.result : { approved: false, reason: "error", msg: r1.reason?.message };
  const o2 = r2.status === "fulfilled" ? r2.value.result : { approved: false, reason: "error", msg: r2.reason?.message };
  const retries = (r1.status === "fulfilled" ? r1.value.retries : 0) + (r2.status === "fulfilled" ? r2.value.retries : 0);

  const recs = await db.purchaseRecord.findMany({ where: { scopeKey: TEST_ORG_ID, itemName: { startsWith: `${TEST_PREFIX}_c1_` } } });
  const evts = await db.budgetEvent.findMany({ where: { organizationId: TEST_ORG_ID, eventType: "approval_reserved", budgetEventKey: { contains: "approval_reserved" } } });
  const committed = recs.reduce((s, r) => s + r.amount, 0);
  const approvedN = [o1.approved, o2.approved].filter(Boolean).length;

  const passed = approvedN <= 1 && committed <= 100000;
  results.push({ name, passed, detail: `approved=${approvedN} committed=${committed} events=${evts.length} retries=${retries}`,
    snap: { approved: approvedN, committed, events: evts.length, retries, o1, o2 } });
  console.log(`    ${passed ? "✓" : "✗"} approved=${approvedN} committed=${committed} retries=${retries}`);
}

// ── C2: Approve + Cancel Race ──

async function testC2() {
  const name = "C2: approve + cancel race — 최종 잔액 정합성";
  console.log(`  [${name}]`);
  const catId = `${TEST_PREFIX}_cat`;
  const reqBase = `${TEST_PREFIX}_c2`;

  // Setup: 기존 50k 승인
  await db.$transaction(async (tx) => {
    await tx.purchaseRecord.create({
      data: { scopeKey: TEST_ORG_ID, purchasedAt: new Date(2026, 3, 14), vendorName: `${TEST_PREFIX}_v`,
        itemName: `${TEST_PREFIX}_c2_base`, qty: 1, amount: 50000, normalizedCategoryId: catId },
    });
    await tx.budgetEvent.create({
      data: { organizationId: TEST_ORG_ID, budgetEventKey: `${TEST_ORG_ID}:${reqBase}:approval_reserved:${catId}`,
        eventType: "approval_reserved", sourceEntityType: "purchase_request", sourceEntityId: reqBase,
        categoryId: catId, yearMonth: "2026-04", amount: 50000, preCommitted: 0, postCommitted: 50000,
        executedBy: `${TEST_PREFIX}_u` },
    });
  }, { isolationLevel: "Serializable", timeout: 10000 });

  const newReq = `${TEST_PREFIX}_c2_new`;

  const approveTask = withSerializableRetry(async (tx) => {
    const ms = new Date(2026, 3, 1), me = new Date(2026, 4, 1);
    const rows = await tx.purchaseRecord.groupBy({
      by: ["normalizedCategoryId"],
      where: { scopeKey: TEST_ORG_ID, normalizedCategoryId: catId, purchasedAt: { gte: ms, lt: me } },
      _sum: { amount: true },
    });
    const cur = rows[0]?._sum?.amount ?? 0;
    const budget = await tx.categoryBudget.findFirst({
      where: { organizationId: TEST_ORG_ID, categoryId: catId, yearMonth: "2026-04", isActive: true },
    });
    if (budget && ((cur + 50000) / budget.amount) * 100 >= budget.hardStopPercent) {
      return { approved: false, reason: "hard_stop", cur };
    }
    await tx.purchaseRecord.create({
      data: { scopeKey: TEST_ORG_ID, purchasedAt: new Date(2026, 3, 14), vendorName: `${TEST_PREFIX}_v`,
        itemName: `${TEST_PREFIX}_c2_new`, qty: 1, amount: 50000, normalizedCategoryId: catId },
    });
    await tx.budgetEvent.create({
      data: { organizationId: TEST_ORG_ID, budgetEventKey: `${TEST_ORG_ID}:${newReq}:approval_reserved:${catId}`,
        eventType: "approval_reserved", sourceEntityType: "purchase_request", sourceEntityId: newReq,
        categoryId: catId, yearMonth: "2026-04", amount: 50000, preCommitted: cur, postCommitted: cur + 50000,
        executedBy: `${TEST_PREFIX}_u` },
    });
    return { approved: true, cur };
  });

  const cancelTask = withSerializableRetry(async (tx) => {
    const reserves = await tx.budgetEvent.findMany({
      where: { organizationId: TEST_ORG_ID, sourceEntityId: reqBase, eventType: "approval_reserved" },
    });
    if (!reserves.length) return { cancelled: false, reason: "no_reserve" };
    const reserve = reserves[0];
    const ms = new Date(2026, 3, 1), me = new Date(2026, 4, 1);
    const rows = await tx.purchaseRecord.groupBy({
      by: ["normalizedCategoryId"],
      where: { scopeKey: TEST_ORG_ID, normalizedCategoryId: catId, purchasedAt: { gte: ms, lt: me } },
      _sum: { amount: true },
    });
    const cur = rows[0]?._sum?.amount ?? 0;
    if (cur < reserve.amount) {
      telemetry.negative_committed_spend_block_count++;
      return { cancelled: false, reason: "negative_block" };
    }
    await tx.purchaseRecord.deleteMany({ where: { scopeKey: TEST_ORG_ID, itemName: `${TEST_PREFIX}_c2_base` } });
    try {
      await tx.budgetEvent.create({
        data: { organizationId: TEST_ORG_ID, budgetEventKey: `${TEST_ORG_ID}:${reqBase}:request_cancel_released:${catId}`,
          eventType: "request_cancel_released", sourceEntityType: "purchase_request", sourceEntityId: reqBase,
          categoryId: catId, yearMonth: "2026-04", amount: -reserve.amount, preCommitted: cur,
          postCommitted: cur - reserve.amount, executedBy: `${TEST_PREFIX}_u` },
      });
    } catch (err) {
      if (err.code === "P2002") { telemetry.budget_event_idempotent_skip_count++; return { cancelled: false, reason: "idempotent" }; }
      throw err;
    }
    return { cancelled: true, released: reserve.amount };
  });

  const [ar, cr] = await Promise.allSettled([approveTask, cancelTask]);
  const ao = ar.status === "fulfilled" ? ar.value.result : { approved: false, err: ar.reason?.message };
  const co = cr.status === "fulfilled" ? cr.value.result : { cancelled: false, err: cr.reason?.message };

  const recs = await db.purchaseRecord.findMany({ where: { scopeKey: TEST_ORG_ID, itemName: { startsWith: `${TEST_PREFIX}_c2_` } } });
  const committed = recs.reduce((s, r) => s + r.amount, 0);
  const evts = await db.budgetEvent.findMany({ where: { organizationId: TEST_ORG_ID, sourceEntityId: { in: [reqBase, newReq] } } });

  const passed = committed >= 0 && committed <= 100000;
  results.push({ name, passed, detail: `committed=${committed} records=${recs.length} events=${evts.length}`,
    snap: { committed, records: recs.length, events: evts.length, approve: ao, cancel: co } });
  console.log(`    ${passed ? "✓" : "✗"} committed=${committed} records=${recs.length} events=${evts.length}`);
}

// ── C3: Cancel Duplicate Replay ──

async function testC3() {
  const name = "C3: cancel duplicate replay — budgetEventKey idempotent skip";
  console.log(`  [${name}]`);
  const catId = `${TEST_PREFIX}_cat`;
  const reqId = `${TEST_PREFIX}_c3`;

  await db.$transaction(async (tx) => {
    await tx.purchaseRecord.create({
      data: { scopeKey: TEST_ORG_ID, purchasedAt: new Date(2026, 3, 14), vendorName: `${TEST_PREFIX}_v`,
        itemName: `${TEST_PREFIX}_c3_item`, qty: 1, amount: 30000, normalizedCategoryId: catId },
    });
    await tx.budgetEvent.create({
      data: { organizationId: TEST_ORG_ID, budgetEventKey: `${TEST_ORG_ID}:${reqId}:approval_reserved:${catId}`,
        eventType: "approval_reserved", sourceEntityType: "purchase_request", sourceEntityId: reqId,
        categoryId: catId, yearMonth: "2026-04", amount: 30000, preCommitted: 0, postCommitted: 30000,
        executedBy: `${TEST_PREFIX}_u` },
    });
  }, { isolationLevel: "Serializable", timeout: 10000 });

  const cancelOnce = () => db.$transaction(async (tx) => {
    const key = `${TEST_ORG_ID}:${reqId}:request_cancel_released:${catId}`;
    try {
      await tx.budgetEvent.create({
        data: { organizationId: TEST_ORG_ID, budgetEventKey: key, eventType: "request_cancel_released",
          sourceEntityType: "purchase_request", sourceEntityId: reqId, categoryId: catId,
          yearMonth: "2026-04", amount: -30000, preCommitted: 30000, postCommitted: 0,
          executedBy: `${TEST_PREFIX}_u` },
      });
      await tx.purchaseRecord.deleteMany({ where: { scopeKey: TEST_ORG_ID, itemName: `${TEST_PREFIX}_c3_item` } });
      return { recorded: true };
    } catch (err) {
      if (err.code === "P2002") { telemetry.budget_event_idempotent_skip_count++; return { recorded: false, skip: true }; }
      throw err;
    }
  }, { isolationLevel: "Serializable", timeout: 10000 });

  const [a, b, c] = await Promise.allSettled([cancelOnce(), cancelOnce(), cancelOnce()]);
  const outs = [a, b, c].map(r => r.status === "fulfilled" ? r.value : { error: r.reason?.message });
  const recorded = outs.filter(o => o.recorded).length;
  const skipped = outs.filter(o => o.skip).length;

  const dbEvts = await db.budgetEvent.findMany({
    where: { organizationId: TEST_ORG_ID, sourceEntityId: reqId, eventType: "request_cancel_released" },
  });

  const passed = dbEvts.length === 1 && recorded === 1;
  results.push({ name, passed, detail: `recorded=${recorded} skipped=${skipped} dbEvents=${dbEvts.length}`,
    snap: { recorded, skipped, dbEvents: dbEvts.length, outs } });
  console.log(`    ${passed ? "✓" : "✗"} recorded=${recorded} skipped=${skipped} dbEvents=${dbEvts.length}`);
}

// ── C4: Retry Exhausted Path ──

async function testC4() {
  const name = "C4: retry exhausted — telemetry + 도메인 오류";
  console.log(`  [${name}]`);

  const prev = telemetry.budget_tx_exhausted_retries;
  let caught = null;
  try {
    await withSerializableRetry(async () => {
      const e = new Error("sim serialization_failure");
      e.code = "P2034";
      throw e;
    }, 0, "test_exhaust");
  } catch (err) { caught = err; }

  const after = telemetry.budget_tx_exhausted_retries;
  const passed = caught !== null && caught.code === "P2034" && after === prev + 1;
  results.push({ name, passed, detail: `caught=${!!caught} code=${caught?.code} exhausted=${after}`,
    snap: { code: caught?.code, before: prev, after } });
  console.log(`    ${passed ? "✓" : "✗"} code=${caught?.code} exhausted=${after}`);
}

// ── C5: budgetEventKey Unique ──

async function testC5() {
  const name = "C5: budgetEventKey unique — P2002 idempotent skip";
  console.log(`  [${name}]`);
  const catId = `${TEST_PREFIX}_cat`;
  const reqId = `${TEST_PREFIX}_c5`;
  const ek = `${TEST_ORG_ID}:${reqId}:approval_reserved:${catId}`;

  await db.budgetEvent.create({
    data: { organizationId: TEST_ORG_ID, budgetEventKey: ek, eventType: "approval_reserved",
      sourceEntityType: "purchase_request", sourceEntityId: reqId, categoryId: catId,
      yearMonth: "2026-04", amount: 25000, preCommitted: 0, postCommitted: 25000,
      executedBy: `${TEST_PREFIX}_u` },
  });

  let caught = false, isP2002 = false;
  try {
    await db.budgetEvent.create({
      data: { organizationId: TEST_ORG_ID, budgetEventKey: ek, eventType: "approval_reserved",
        sourceEntityType: "purchase_request", sourceEntityId: reqId, categoryId: catId,
        yearMonth: "2026-04", amount: 25000, preCommitted: 0, postCommitted: 25000,
        executedBy: `${TEST_PREFIX}_u` },
    });
  } catch (err) {
    caught = true;
    isP2002 = err.code === "P2002";
    if (isP2002) telemetry.budget_event_idempotent_skip_count++;
  }

  const evts = await db.budgetEvent.findMany({ where: { budgetEventKey: ek } });
  const passed = caught && isP2002 && evts.length === 1;
  results.push({ name, passed, detail: `P2002=${isP2002} dbCount=${evts.length}`,
    snap: { P2002: isP2002, dbCount: evts.length } });
  console.log(`    ${passed ? "✓" : "✗"} P2002=${isP2002} dbCount=${evts.length}`);
}

// ── Main ──

async function main() {
  console.log("=".repeat(60));
  console.log("Budget PostgreSQL Contention Validation");
  console.log("=".repeat(60));

  try {
    await db.$connect();
    console.log("  ✓ PostgreSQL connected");
    await setup();
    console.log("  === 테스트 실행 ===\n");
    await testC1();
    await testC2();
    await testC3();
    await testC4();
    await testC5();
  } catch (err) {
    console.error("\n❌ Fatal:", err.message, err.stack?.split("\n").slice(0,3).join("\n"));
    results.push({ name: "FATAL", passed: false, detail: err.message });
  } finally {
    await teardown();
  }

  console.log("=".repeat(60));
  console.log("결과 요약");
  console.log("=".repeat(60));

  for (const r of results) {
    console.log(`  ${r.passed ? "✓" : "✗"} ${r.name}`);
    console.log(`    ${r.detail}`);
    if (r.snap) console.log(`    DB: ${JSON.stringify(r.snap)}`);
  }

  console.log("\n  === Telemetry ===");
  for (const [k, v] of Object.entries(telemetry)) console.log(`    ${k}: ${v}`);
  const p = results.filter(r => r.passed).length, f = results.filter(r => !r.passed).length;
  console.log(`\n총 ${results.length}개 중 ${p}개 통과, ${f}개 실패`);
  if (f > 0) process.exitCode = 1;
}

main();
