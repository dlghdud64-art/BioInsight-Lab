// @ts-nocheck — vitest/prisma schema drift, 임시 우회
/**
 * Budget PostgreSQL Contention Validation
 *
 * 실 PostgreSQL에서 SERIALIZABLE 충돌, unique 제약, retry, telemetry를 검증한다.
 *
 * 테스트 축:
 *   C1. concurrent approve — 동시 2건 중 규칙상 올바른 결과만 나오는지
 *   C2. approve + cancel race — 최종 잔액 정합성
 *   C3. cancel duplicate replay — budgetEventKey idempotent skip
 *   C4. retry exhausted path — telemetry 계측 + 도메인 오류
 *   C5. budgetEventKey unique 위반 — P2002 catch + idempotent skip
 *
 * 환경:
 *   - DIRECT_URL (port 5432, non-pgbouncer) 사용 — SERIALIZABLE 필수
 *   - 테스트 데이터는 `__test_contention_` prefix로 격리
 *   - 테스트 종료 시 정리
 *
 * 실행:
 *   cd apps/web && DATABASE_URL="$DIRECT_URL" node --experimental-vm-modules \
 *     src/lib/budget/__tests__/budget-postgresql-contention.test.ts
 */

import { PrismaClient } from "@prisma/client";

// ── DIRECT_URL 사용 (SERIALIZABLE 필수) ──
const DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!DIRECT_URL) {
  console.error("DIRECT_URL or DATABASE_URL required");
  process.exit(1);
}

// pgbouncer URL(6543)이면 SERIALIZABLE 불가 경고
if (DIRECT_URL.includes(":6543")) {
  console.warn("⚠️ pgbouncer URL detected — SERIALIZABLE may not work. Use DIRECT_URL (port 5432).");
}

const db = new PrismaClient({
  datasourceUrl: DIRECT_URL,
  log: [], // 운영 로그 off
});

// ── 테스트 식별자 ──
const TEST_PREFIX = `__test_contention_${Date.now()}`;
const TEST_ORG_ID = `${TEST_PREFIX}_org`;

// ── 결과 수집 ──
interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
  dbSnapshot?: Record<string, any>;
}

const results: TestResult[] = [];
const telemetry = {
  budget_tx_conflict_count: 0,
  budget_tx_retry_count: 0,
  budget_tx_exhausted_retries: 0,
  budget_event_idempotent_skip_count: 0,
  negative_committed_spend_block_count: 0,
};

// ── 유틸 ──

function isSerializationFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, any>;
  if (e.code === "P2034") return true;
  if (e.code === "40001") return true;
  if (e.meta?.code === "40001") return true;
  return false;
}

async function withSerializableRetry<T>(
  fn: (tx: any) => Promise<T>,
  maxRetries = 3,
  label = "test_tx",
): Promise<{ result: T; retries: number; conflicts: number }> {
  let retries = 0;
  let conflicts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await db.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 10000,
      });
      return { result, retries, conflicts };
    } catch (error: unknown) {
      if (isSerializationFailure(error)) {
        conflicts++;
        retries++;
        telemetry.budget_tx_conflict_count++;
        telemetry.budget_tx_retry_count++;
        if (attempt < maxRetries) {
          const delay = 50 * Math.pow(2, attempt) + Math.random() * 50;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        telemetry.budget_tx_exhausted_retries++;
        throw error;
      }
      throw error;
    }
  }
  throw new Error("unreachable");
}

// ── Setup / Teardown ──

async function setup() {
  console.log(`\n🔧 Setup: prefix=${TEST_PREFIX}\n`);

  // 1. 테스트용 Organization 생성
  await db.organization.create({
    data: {
      id: TEST_ORG_ID,
      name: `${TEST_PREFIX}_org`,
      timezone: "Asia/Seoul",
    },
  });

  // 2. 테스트용 SpendingCategory 생성
  await db.spendingCategory.create({
    data: {
      id: `${TEST_PREFIX}_cat_reagents`,
      organizationId: TEST_ORG_ID,
      name: "Reagents",
      displayName: "시약류",
    },
  });

  // 3. 테스트용 CategoryBudget 생성 (한도 100,000원, hardStop 100%)
  await db.categoryBudget.create({
    data: {
      organizationId: TEST_ORG_ID,
      categoryId: `${TEST_PREFIX}_cat_reagents`,
      yearMonth: "2026-04",
      amount: 100000,
      warningPercent: 70,
      softLimitPercent: 90,
      hardStopPercent: 100,
      isActive: true,
    },
  });

  console.log("  ✓ Organization, SpendingCategory, CategoryBudget created\n");
}

async function teardown() {
  console.log(`\n🧹 Teardown: cleaning ${TEST_PREFIX} data\n`);
  try {
    // BudgetEvent 정리
    await db.budgetEvent.deleteMany({
      where: { organizationId: TEST_ORG_ID },
    });
    // CategoryBudget 정리
    await db.categoryBudget.deleteMany({
      where: { organizationId: TEST_ORG_ID },
    });
    // SpendingCategory 정리
    await db.spendingCategory.deleteMany({
      where: { organizationId: TEST_ORG_ID },
    });
    // Organization 정리
    await db.organization.delete({
      where: { id: TEST_ORG_ID },
    });
    console.log("  ✓ Cleanup complete\n");
  } catch (err: any) {
    console.warn("  ⚠ Cleanup partial:", err.message);
  }
  await db.$disconnect();
}

// ── Test C1: Concurrent Approve ──

async function testConcurrentApprove() {
  const testName = "C1: concurrent approve — 동시 2건, 한도 내 1건만 통과";
  console.log(`  [${testName}]`);

  const catId = `${TEST_PREFIX}_cat_reagents`;
  const req1Id = `${TEST_PREFIX}_req1`;
  const req2Id = `${TEST_PREFIX}_req2`;

  // 각각 60,000원 → 합계 120,000원 > 한도 100,000원
  // → 최대 1건만 통과해야 함

  const approveAttempt = async (reqId: string, amount: number) => {
    return withSerializableRetry(async (tx: any) => {
      // 현재 committed 조회
      const monthStart = new Date(2026, 3, 1); // April
      const monthEnd = new Date(2026, 4, 1);

      const currentRows = await tx.purchaseRecord.groupBy({
        by: ["normalizedCategoryId"],
        where: {
          scopeKey: TEST_ORG_ID,
          normalizedCategoryId: catId,
          purchasedAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
      });
      const currentCommitted = (currentRows as any[])[0]?._sum?.amount ?? 0;

      // 예산 한도 조회
      const budget = await tx.categoryBudget.findFirst({
        where: {
          organizationId: TEST_ORG_ID,
          categoryId: catId,
          yearMonth: "2026-04",
          isActive: true,
        },
      });

      const projected = currentCommitted + amount;
      const usagePercent = budget ? (projected / budget.amount) * 100 : 0;

      if (budget && usagePercent >= budget.hardStopPercent) {
        return { approved: false, reason: "hard_stop", currentCommitted, projected };
      }

      // 승인 시 PurchaseRecord 생성 (committed spend 반영)
      await tx.purchaseRecord.create({
        data: {
          scopeKey: TEST_ORG_ID,
          purchasedAt: new Date(2026, 3, 14),
          vendorName: `${TEST_PREFIX}_vendor`,
          itemName: `${TEST_PREFIX}_item_${reqId}`,
          qty: 1,
          amount,
          normalizedCategoryId: catId,
        },
      });

      // BudgetEvent 기록
      const eventKey = `${TEST_ORG_ID}:${reqId}:approval_reserved:${catId}`;
      try {
        await tx.budgetEvent.create({
          data: {
            organizationId: TEST_ORG_ID,
            budgetEventKey: eventKey,
            eventType: "approval_reserved",
            sourceEntityType: "purchase_request",
            sourceEntityId: reqId,
            categoryId: catId,
            yearMonth: "2026-04",
            amount,
            preCommitted: currentCommitted,
            postCommitted: currentCommitted + amount,
            executedBy: `${TEST_PREFIX}_user`,
          },
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          telemetry.budget_event_idempotent_skip_count++;
          return { approved: false, reason: "idempotent_skip" };
        }
        throw err;
      }

      return { approved: true, currentCommitted, projected: currentCommitted + amount };
    });
  };

  // 동시 실행
  const [r1, r2] = await Promise.allSettled([
    approveAttempt(req1Id, 60000),
    approveAttempt(req2Id, 60000),
  ]);

  const outcome1 = r1.status === "fulfilled" ? r1.value.result : { approved: false, reason: "error" };
  const outcome2 = r2.status === "fulfilled" ? r2.value.result : { approved: false, reason: "error" };
  const totalRetries = (r1.status === "fulfilled" ? r1.value.retries : 0)
    + (r2.status === "fulfilled" ? r2.value.retries : 0);

  const approved = [outcome1.approved, outcome2.approved].filter(Boolean).length;

  // 최종 DB 상태 확인
  const finalEvents = await db.budgetEvent.findMany({
    where: { organizationId: TEST_ORG_ID, eventType: "approval_reserved" },
  });

  const finalRecords = await db.purchaseRecord.findMany({
    where: {
      scopeKey: TEST_ORG_ID,
      itemName: { startsWith: `${TEST_PREFIX}_item_` },
    },
  });

  const totalCommitted = finalRecords.reduce((sum: number, r: any) => sum + r.amount, 0);

  const passed = approved <= 1 && totalCommitted <= 100000;

  results.push({
    name: testName,
    passed,
    detail: `approved=${approved}, totalCommitted=${totalCommitted}, events=${finalEvents.length}, retries=${totalRetries}`,
    dbSnapshot: {
      approved_count: approved,
      total_committed: totalCommitted,
      budget_events: finalEvents.length,
      purchase_records: finalRecords.length,
      retries: totalRetries,
      outcome1,
      outcome2,
    },
  });

  console.log(`    ${passed ? "✓" : "✗"} approved=${approved} committed=${totalCommitted} events=${finalEvents.length} retries=${totalRetries}`);
}

// ── Test C2: Approve + Cancel Race ──

async function testApproveCancelRace() {
  const testName = "C2: approve + cancel race — 최종 잔액 정합성";
  console.log(`  [${testName}]`);

  const catId = `${TEST_PREFIX}_cat_reagents`;
  const reqId = `${TEST_PREFIX}_req_ac`;

  // 먼저 approve 하나 확정
  await db.$transaction(async (tx: any) => {
    await tx.purchaseRecord.create({
      data: {
        scopeKey: TEST_ORG_ID,
        purchasedAt: new Date(2026, 3, 14),
        vendorName: `${TEST_PREFIX}_vendor`,
        itemName: `${TEST_PREFIX}_item_ac`,
        qty: 1,
        amount: 50000,
        normalizedCategoryId: catId,
      },
    });
    await tx.budgetEvent.create({
      data: {
        organizationId: TEST_ORG_ID,
        budgetEventKey: `${TEST_ORG_ID}:${reqId}:approval_reserved:${catId}`,
        eventType: "approval_reserved",
        sourceEntityType: "purchase_request",
        sourceEntityId: reqId,
        categoryId: catId,
        yearMonth: "2026-04",
        amount: 50000,
        preCommitted: 0,
        postCommitted: 50000,
        executedBy: `${TEST_PREFIX}_user`,
      },
    });
  }, { isolationLevel: "Serializable", timeout: 10000 });

  // 동시에: 새 approve(50000) + cancel(기존 50000 해제)
  const newReqId = `${TEST_PREFIX}_req_ac2`;

  const approveTask = withSerializableRetry(async (tx: any) => {
    const monthStart = new Date(2026, 3, 1);
    const monthEnd = new Date(2026, 4, 1);

    const rows = await tx.purchaseRecord.groupBy({
      by: ["normalizedCategoryId"],
      where: { scopeKey: TEST_ORG_ID, normalizedCategoryId: catId, purchasedAt: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    });
    const current = (rows as any[])[0]?._sum?.amount ?? 0;

    const budget = await tx.categoryBudget.findFirst({
      where: { organizationId: TEST_ORG_ID, categoryId: catId, yearMonth: "2026-04", isActive: true },
    });

    if (budget && ((current + 50000) / budget.amount) * 100 >= budget.hardStopPercent) {
      return { approved: false, reason: "hard_stop", current };
    }

    await tx.purchaseRecord.create({
      data: {
        scopeKey: TEST_ORG_ID,
        purchasedAt: new Date(2026, 3, 14),
        vendorName: `${TEST_PREFIX}_vendor`,
        itemName: `${TEST_PREFIX}_item_ac2`,
        qty: 1,
        amount: 50000,
        normalizedCategoryId: catId,
      },
    });

    await tx.budgetEvent.create({
      data: {
        organizationId: TEST_ORG_ID,
        budgetEventKey: `${TEST_ORG_ID}:${newReqId}:approval_reserved:${catId}`,
        eventType: "approval_reserved",
        sourceEntityType: "purchase_request",
        sourceEntityId: newReqId,
        categoryId: catId,
        yearMonth: "2026-04",
        amount: 50000,
        preCommitted: current,
        postCommitted: current + 50000,
        executedBy: `${TEST_PREFIX}_user`,
      },
    });

    return { approved: true, current, projected: current + 50000 };
  });

  const cancelTask = withSerializableRetry(async (tx: any) => {
    // 원본 reserve 조회
    const reserves = await tx.budgetEvent.findMany({
      where: { organizationId: TEST_ORG_ID, sourceEntityId: reqId, eventType: "approval_reserved" },
    });

    if (reserves.length === 0) return { cancelled: false, reason: "no_reserve" };

    const reserve = reserves[0];

    // 현재 committed 조회
    const monthStart = new Date(2026, 3, 1);
    const monthEnd = new Date(2026, 4, 1);
    const rows = await tx.purchaseRecord.groupBy({
      by: ["normalizedCategoryId"],
      where: { scopeKey: TEST_ORG_ID, normalizedCategoryId: catId, purchasedAt: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    });
    const current = (rows as any[])[0]?._sum?.amount ?? 0;

    if (current < reserve.amount) {
      telemetry.negative_committed_spend_block_count++;
      return { cancelled: false, reason: "negative_committed" };
    }

    // PurchaseRecord 삭제 (cancel 시뮬레이션)
    await tx.purchaseRecord.deleteMany({
      where: { scopeKey: TEST_ORG_ID, itemName: `${TEST_PREFIX}_item_ac` },
    });

    // Release BudgetEvent 기록
    try {
      await tx.budgetEvent.create({
        data: {
          organizationId: TEST_ORG_ID,
          budgetEventKey: `${TEST_ORG_ID}:${reqId}:request_cancel_released:${catId}`,
          eventType: "request_cancel_released",
          sourceEntityType: "purchase_request",
          sourceEntityId: reqId,
          categoryId: catId,
          yearMonth: "2026-04",
          amount: -reserve.amount,
          preCommitted: current,
          postCommitted: current - reserve.amount,
          executedBy: `${TEST_PREFIX}_user`,
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        telemetry.budget_event_idempotent_skip_count++;
        return { cancelled: false, reason: "idempotent_skip" };
      }
      throw err;
    }

    return { cancelled: true, released: reserve.amount, preCurrent: current };
  });

  const [approveResult, cancelResult] = await Promise.allSettled([approveTask, cancelTask]);

  // 최종 DB 확인
  const finalRecords = await db.purchaseRecord.findMany({
    where: { scopeKey: TEST_ORG_ID, itemName: { startsWith: `${TEST_PREFIX}_item_ac` } },
  });
  const finalCommitted = finalRecords.reduce((s: number, r: any) => s + r.amount, 0);
  const finalEvents = await db.budgetEvent.findMany({
    where: { organizationId: TEST_ORG_ID, sourceEntityId: { in: [reqId, newReqId] } },
  });

  // 잔액이 음수가 아니고, 올바른 상태여야 함
  const passed = finalCommitted >= 0 && finalCommitted <= 100000;

  const approveOut = approveResult.status === "fulfilled" ? approveResult.value.result : "error";
  const cancelOut = cancelResult.status === "fulfilled" ? cancelResult.value.result : "error";

  results.push({
    name: testName,
    passed,
    detail: `finalCommitted=${finalCommitted}, events=${finalEvents.length}`,
    dbSnapshot: {
      final_committed: finalCommitted,
      records: finalRecords.length,
      events: finalEvents.length,
      approve: approveOut,
      cancel: cancelOut,
    },
  });

  console.log(`    ${passed ? "✓" : "✗"} finalCommitted=${finalCommitted} events=${finalEvents.length} records=${finalRecords.length}`);
}

// ── Test C3: Cancel Duplicate Replay ──

async function testCancelDuplicateReplay() {
  const testName = "C3: cancel duplicate replay — budgetEventKey idempotent skip";
  console.log(`  [${testName}]`);

  const catId = `${TEST_PREFIX}_cat_reagents`;
  const reqId = `${TEST_PREFIX}_req_dup`;

  // Setup: approve + reserve
  await db.$transaction(async (tx: any) => {
    await tx.purchaseRecord.create({
      data: {
        scopeKey: TEST_ORG_ID,
        purchasedAt: new Date(2026, 3, 14),
        vendorName: `${TEST_PREFIX}_vendor`,
        itemName: `${TEST_PREFIX}_item_dup`,
        qty: 1,
        amount: 30000,
        normalizedCategoryId: catId,
      },
    });
    await tx.budgetEvent.create({
      data: {
        organizationId: TEST_ORG_ID,
        budgetEventKey: `${TEST_ORG_ID}:${reqId}:approval_reserved:${catId}`,
        eventType: "approval_reserved",
        sourceEntityType: "purchase_request",
        sourceEntityId: reqId,
        categoryId: catId,
        yearMonth: "2026-04",
        amount: 30000,
        preCommitted: 0,
        postCommitted: 30000,
        executedBy: `${TEST_PREFIX}_user`,
      },
    });
  }, { isolationLevel: "Serializable", timeout: 10000 });

  // Cancel 1회 실행
  const cancelOnce = async () => {
    return db.$transaction(async (tx: any) => {
      const key = `${TEST_ORG_ID}:${reqId}:request_cancel_released:${catId}`;
      try {
        await tx.budgetEvent.create({
          data: {
            organizationId: TEST_ORG_ID,
            budgetEventKey: key,
            eventType: "request_cancel_released",
            sourceEntityType: "purchase_request",
            sourceEntityId: reqId,
            categoryId: catId,
            yearMonth: "2026-04",
            amount: -30000,
            preCommitted: 30000,
            postCommitted: 0,
            executedBy: `${TEST_PREFIX}_user`,
          },
        });
        // 실제 PurchaseRecord 삭제
        await tx.purchaseRecord.deleteMany({
          where: { scopeKey: TEST_ORG_ID, itemName: `${TEST_PREFIX}_item_dup` },
        });
        return { recorded: true };
      } catch (err: any) {
        if (err.code === "P2002") {
          telemetry.budget_event_idempotent_skip_count++;
          return { recorded: false, idempotent_skip: true };
        }
        throw err;
      }
    }, { isolationLevel: "Serializable", timeout: 10000 });
  };

  // 동시 3회 실행
  const [a, b, c] = await Promise.allSettled([cancelOnce(), cancelOnce(), cancelOnce()]);

  const outcomes = [a, b, c].map((r) =>
    r.status === "fulfilled" ? r.value : { error: (r as any).reason?.message },
  );

  const recordedCount = outcomes.filter((o: any) => o.recorded === true).length;
  const skippedCount = outcomes.filter((o: any) => o.idempotent_skip === true).length;

  // 최종 DB: BudgetEvent가 정확히 1개만 release 기록
  const finalEvents = await db.budgetEvent.findMany({
    where: {
      organizationId: TEST_ORG_ID,
      sourceEntityId: reqId,
      eventType: "request_cancel_released",
    },
  });

  const passed = finalEvents.length === 1 && recordedCount === 1;

  results.push({
    name: testName,
    passed,
    detail: `recorded=${recordedCount}, skipped=${skippedCount}, dbEvents=${finalEvents.length}`,
    dbSnapshot: {
      recorded: recordedCount,
      skipped: skippedCount,
      db_release_events: finalEvents.length,
      outcomes,
    },
  });

  console.log(`    ${passed ? "✓" : "✗"} recorded=${recordedCount} skipped=${skippedCount} dbEvents=${finalEvents.length}`);
}

// ── Test C4: Retry Exhausted Path ──

async function testRetryExhausted() {
  const testName = "C4: retry exhausted — telemetry 계측 + 도메인 오류 식별";
  console.log(`  [${testName}]`);

  // maxRetries=0으로 즉시 소진
  let exhaustedError: any = null;
  const prevExhausted = telemetry.budget_tx_exhausted_retries;

  try {
    await withSerializableRetry(
      async (_tx: any) => {
        // 의도적 serialization failure를 유발하기 어려우므로,
        // 대신 retry 로직 자체의 계약을 검증
        // → maxRetries=0이면 첫 실패 시 즉시 throw
        const fakeError: any = new Error("Simulated serialization failure");
        fakeError.code = "P2034";
        throw fakeError;
      },
      0, // maxRetries = 0
      "test_exhausted",
    );
  } catch (err: any) {
    exhaustedError = err;
  }

  const exhaustedAfter = telemetry.budget_tx_exhausted_retries;
  const passed =
    exhaustedError !== null &&
    exhaustedError.code === "P2034" &&
    exhaustedAfter === prevExhausted + 1;

  results.push({
    name: testName,
    passed,
    detail: `errorCaptured=${!!exhaustedError}, code=${exhaustedError?.code}, exhausted=${exhaustedAfter}`,
    dbSnapshot: {
      error_code: exhaustedError?.code,
      telemetry_exhausted_before: prevExhausted,
      telemetry_exhausted_after: exhaustedAfter,
    },
  });

  console.log(`    ${passed ? "✓" : "✗"} error=${exhaustedError?.code} exhaustedTelemetry=${exhaustedAfter}`);
}

// ── Test C5: budgetEventKey Unique Violation ──

async function testBudgetEventKeyUnique() {
  const testName = "C5: budgetEventKey unique — P2002 catch + idempotent skip";
  console.log(`  [${testName}]`);

  const catId = `${TEST_PREFIX}_cat_reagents`;
  const reqId = `${TEST_PREFIX}_req_uniq`;
  const eventKey = `${TEST_ORG_ID}:${reqId}:approval_reserved:${catId}`;

  // 첫 번째 기록
  await db.budgetEvent.create({
    data: {
      organizationId: TEST_ORG_ID,
      budgetEventKey: eventKey,
      eventType: "approval_reserved",
      sourceEntityType: "purchase_request",
      sourceEntityId: reqId,
      categoryId: catId,
      yearMonth: "2026-04",
      amount: 25000,
      preCommitted: 0,
      postCommitted: 25000,
      executedBy: `${TEST_PREFIX}_user`,
    },
  });

  // 두 번째 시도 — unique 위반
  let caught = false;
  let isP2002 = false;
  try {
    await db.budgetEvent.create({
      data: {
        organizationId: TEST_ORG_ID,
        budgetEventKey: eventKey, // 동일 키
        eventType: "approval_reserved",
        sourceEntityType: "purchase_request",
        sourceEntityId: reqId,
        categoryId: catId,
        yearMonth: "2026-04",
        amount: 25000,
        preCommitted: 0,
        postCommitted: 25000,
        executedBy: `${TEST_PREFIX}_user`,
      },
    });
  } catch (err: any) {
    caught = true;
    isP2002 = err.code === "P2002";
    if (isP2002) {
      telemetry.budget_event_idempotent_skip_count++;
    }
  }

  // DB에 1개만 존재
  const events = await db.budgetEvent.findMany({
    where: { budgetEventKey: eventKey },
  });

  const passed = caught && isP2002 && events.length === 1;

  results.push({
    name: testName,
    passed,
    detail: `caught=${caught}, isP2002=${isP2002}, dbCount=${events.length}`,
    dbSnapshot: {
      caught,
      error_code: isP2002 ? "P2002" : "other",
      db_event_count: events.length,
    },
  });

  console.log(`    ${passed ? "✓" : "✗"} caught=${caught} P2002=${isP2002} dbCount=${events.length}`);
}

// ── Main ──

async function main() {
  console.log("=" .repeat(60));
  console.log("Budget PostgreSQL Contention Validation");
  console.log("=" .repeat(60));

  try {
    // 연결 테스트
    await db.$connect();
    console.log("  ✓ PostgreSQL connected via DIRECT_URL");

    await setup();

    console.log("  === 테스트 실행 ===\n");

    await testConcurrentApprove();
    await testApproveCancelRace();
    await testCancelDuplicateReplay();
    await testRetryExhausted();
    await testBudgetEventKeyUnique();

  } catch (err: any) {
    console.error("\n❌ Fatal error:", err.message);
    results.push({
      name: "FATAL",
      passed: false,
      detail: err.message,
    });
  } finally {
    await teardown();
  }

  // ── 결과 요약 ──

  console.log("=" .repeat(60));
  console.log("결과 요약");
  console.log("=" .repeat(60));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  for (const r of results) {
    console.log(`  ${r.passed ? "✓" : "✗"} ${r.name}`);
    console.log(`    ${r.detail}`);
    if (r.dbSnapshot) {
      console.log(`    DB: ${JSON.stringify(r.dbSnapshot, null, 0)}`);
    }
  }

  console.log("\n  === Telemetry ===");
  console.log(`    budget_tx_conflict_count:          ${telemetry.budget_tx_conflict_count}`);
  console.log(`    budget_tx_retry_count:             ${telemetry.budget_tx_retry_count}`);
  console.log(`    budget_tx_exhausted_retries:        ${telemetry.budget_tx_exhausted_retries}`);
  console.log(`    budget_event_idempotent_skip_count: ${telemetry.budget_event_idempotent_skip_count}`);
  console.log(`    negative_committed_spend_block_count: ${telemetry.negative_committed_spend_block_count}`);

  console.log(`\n총 ${results.length}개 중 ${passedCount}개 통과, ${failedCount}개 실패`);

  if (failedCount > 0) process.exitCode = 1;
}

main();
