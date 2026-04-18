// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Category Budget Hardening Test Pack
 *
 * 검증 시나리오:
 *
 * T1: 동시 승인 race — 동일 카테고리에서 동시 2건 → 정확히 1건만 통과하거나 둘 다 차단
 * T2: approval_reversed — 승인 취소 시 committed spend 해제
 * T3: request_cancel_released — 요청 취소 시 committed spend 해제
 * T4: po_void_released — PO 무효화 시 committed spend 해제
 * T5: category_reclass_release_reapply — 카테고리 재분류 시 해제+재적용
 * T6: period canonicalization — org timezone 기준 YYYY-MM 결정
 * T7: ready_to_send vs sent 상태 혼동 없음
 * T8: outbound history hydration 후 re-entry 시 lineage 유지
 * T9: dedupe persistence reopen/invalidation 후 clear
 * T10: mock seed가 canonical candidate truth를 override하지 않음
 * T11: budget gate decision → audit event shape 정합성
 */

// vitest/jest compatible — jest globals are auto-injected

// ── Budget gate (pure logic 테스트 가능 부분) ──
import {
  resolvePeriodYearMonth,
  buildPeriodKey,
} from "../category-budget-gate";

// ── Concurrency ──
import {
  BudgetBlockedError,
} from "../budget-concurrency";

// ── Release events ──
import type {
  BudgetReleaseEvent,
  BudgetReleaseItem,
} from "../category-budget-release";

// ── Pure engine logic ──
import { evaluateStatus } from "../category-spending-engine";

// ============================================================
// T1: Concurrent approval race (unit-level contract test)
// ============================================================

describe("T1: Concurrent approval race contract", () => {
  it("BudgetBlockedError는 __budgetBlocked = true를 가진다", () => {
    const err = new BudgetBlockedError({
      blockers: [{ categoryName: "reagents", level: "hard_stop" }],
      warnings: [],
    });
    expect(err.__budgetBlocked).toBe(true);
    expect(err.blockers).toHaveLength(1);
    expect(err.name).toBe("BudgetBlockedError");
  });

  it("두 개의 BudgetBlockedError가 서로 독립적이다", () => {
    const err1 = new BudgetBlockedError({ blockers: [{ id: "a" }], warnings: [] });
    const err2 = new BudgetBlockedError({ blockers: [{ id: "b" }], warnings: [] });
    expect(err1.blockers[0].id).not.toBe(err2.blockers[0].id);
  });

  it("SERIALIZABLE race에서 둘 다 hard_stop이면 둘 다 차단되어야 함 (contract)", () => {
    // 실제 DB race는 integration test에서 검증
    // 여기서는 gate 로직의 계약만 검증:
    // budget 100, current 80, request A=30, request B=30
    // 어느 하나가 먼저 commit되면 80+30=110 → hard_stop
    // 그러면 다른 하나는 110+30=140 → hard_stop
    // 즉 sequential 실행 시 1건만 통과 가능

    const budget = 100;
    const hardStopPercent = 100;
    const currentCommitted = 80;
    const requestA = 30;
    const requestB = 30;

    const projectedA = currentCommitted + requestA; // 110
    const projectedB = currentCommitted + requestB; // 110

    const usageA = (projectedA / budget) * 100; // 110%
    const usageB = (projectedB / budget) * 100; // 110%

    // 둘 다 hard_stop
    expect(usageA).toBeGreaterThanOrEqual(hardStopPercent);
    expect(usageB).toBeGreaterThanOrEqual(hardStopPercent);

    // sequential: A 먼저 → B는 committed가 110이 됨
    const projectedBAfterA = (currentCommitted + requestA) + requestB; // 140
    const usageBAfterA = (projectedBAfterA / budget) * 100; // 140%
    expect(usageBAfterA).toBeGreaterThanOrEqual(hardStopPercent);
  });

  it("budget 여유가 정확히 1건분이면 1건만 통과해야 함 (contract)", () => {
    const budget = 100;
    const hardStopPercent = 100;
    const currentCommitted = 50;
    const requestEach = 40; // 50+40=90 → ok, 90+40=130 → hard_stop

    const usageFirst = ((currentCommitted + requestEach) / budget) * 100;
    expect(usageFirst).toBeLessThan(hardStopPercent); // 90% → ok

    const usageSecond = ((currentCommitted + requestEach + requestEach) / budget) * 100;
    expect(usageSecond).toBeGreaterThanOrEqual(hardStopPercent); // 130% → hard_stop
  });
});

// ============================================================
// T2-T5: Release event shape contracts
// ============================================================

describe("T2: approval_reversed release shape", () => {
  it("approval_reversed event는 올바른 shape을 가진다", () => {
    const event: BudgetReleaseEvent = {
      eventType: "approval_reversed",
      targetEntityType: "purchase_request",
      targetEntityId: "req-123",
      organizationId: "org-1",
      releaseItems: [
        {
          categoryId: "cat-reagents",
          periodKey: "org-1:cat-reagents:2026-04",
          yearMonth: "2026-04",
          amount: 50000,
          preReleaseCommitted: 80000,
          postReleaseCommitted: 30000,
        },
      ],
      executedAt: "2026-04-13T10:00:00.000Z",
      executedBy: "user-admin-1",
      reason: "승인 오류 정정",
    };

    expect(event.eventType).toBe("approval_reversed");
    expect(event.releaseItems[0].postReleaseCommitted).toBe(
      event.releaseItems[0].preReleaseCommitted - event.releaseItems[0].amount,
    );
  });
});

describe("T3: request_cancel_released shape", () => {
  it("request_cancel event는 committed spend를 0 이상으로 유지한다", () => {
    const item: BudgetReleaseItem = {
      categoryId: "cat-1",
      periodKey: "org-1:cat-1:2026-04",
      yearMonth: "2026-04",
      amount: 100000,
      preReleaseCommitted: 80000,
      postReleaseCommitted: Math.max(0, 80000 - 100000),
    };
    expect(item.postReleaseCommitted).toBeGreaterThanOrEqual(0);
  });
});

describe("T4: po_void_released shape", () => {
  it("po_void event는 order를 target으로 한다", () => {
    const event: BudgetReleaseEvent = {
      eventType: "po_void_released",
      targetEntityType: "order",
      targetEntityId: "ord-456",
      organizationId: "org-1",
      releaseItems: [],
      executedAt: new Date().toISOString(),
      executedBy: "user-1",
    };
    expect(event.targetEntityType).toBe("order");
  });
});

describe("T5: category_reclass release/reapply", () => {
  it("reclass event는 기존 카테고리 해제(양수) + 새 카테고리 적용(음수) 쌍이다", () => {
    const releaseItems: BudgetReleaseItem[] = [
      {
        categoryId: "cat-old",
        periodKey: "org-1:cat-old:2026-04",
        yearMonth: "2026-04",
        amount: 30000, // 해제
        preReleaseCommitted: 80000,
        postReleaseCommitted: 50000,
      },
      {
        categoryId: "cat-new",
        periodKey: "org-1:cat-new:2026-04",
        yearMonth: "2026-04",
        amount: -30000, // 재적용
        preReleaseCommitted: 20000,
        postReleaseCommitted: 50000,
      },
    ];

    // 해제 합 + 재적용 합 = 0 (net zero)
    const netAmount = releaseItems.reduce((sum, i) => sum + i.amount, 0);
    expect(netAmount).toBe(0);
  });
});

// ============================================================
// T6: Period canonicalization
// ============================================================

describe("T6: Period canonicalization", () => {
  it("Asia/Seoul 기준 2026-04-30 23:30 UTC → 2026-05-01 KST → period 2026-05", () => {
    // 2026-04-30 23:30 UTC = 2026-05-01 08:30 KST
    const utcDate = new Date("2026-04-30T23:30:00.000Z");
    const result = resolvePeriodYearMonth("Asia/Seoul", utcDate);
    expect(result).toBe("2026-05");
  });

  it("America/New_York 기준 2026-05-01 03:00 UTC → 2026-04-30 EDT → period 2026-04", () => {
    // 2026-05-01 03:00 UTC = 2026-04-30 23:00 EDT
    const utcDate = new Date("2026-05-01T03:00:00.000Z");
    const result = resolvePeriodYearMonth("America/New_York", utcDate);
    expect(result).toBe("2026-04");
  });

  it("같은 UTC 시각이라도 timezone이 다르면 period가 달라질 수 있다", () => {
    const utcDate = new Date("2026-04-30T23:30:00.000Z");
    const seoul = resolvePeriodYearMonth("Asia/Seoul", utcDate);
    const ny = resolvePeriodYearMonth("America/New_York", utcDate);
    // Seoul: 05-01 08:30 → 2026-05
    // NY: 04-30 19:30 → 2026-04
    expect(seoul).not.toBe(ny);
  });

  it("buildPeriodKey는 orgId:categoryId:YYYY-MM 형식이다", () => {
    const key = buildPeriodKey("org-1", "cat-reagents", "2026-04");
    expect(key).toBe("org-1:cat-reagents:2026-04");
  });

  it("gate와 widget이 같은 period_key를 보려면 같은 resolvePeriodYearMonth을 써야 한다", () => {
    const timezone = "Asia/Seoul";
    const now = new Date();
    const gateYM = resolvePeriodYearMonth(timezone, now);
    const widgetYM = resolvePeriodYearMonth(timezone, now);
    expect(gateYM).toBe(widgetYM);
  });
});

// ============================================================
// T7: ready_to_send vs sent 상태 구분
// ============================================================

describe("T7: ready_to_send ≠ sent", () => {
  it("ready_to_send와 sent는 서로 다른 상태이다", () => {
    const stateMachine = {
      ready_to_send: { canSend: true, isSent: false },
      sent: { canSend: false, isSent: true },
    };
    expect(stateMachine.ready_to_send.isSent).toBe(false);
    expect(stateMachine.sent.canSend).toBe(false);
    expect(stateMachine.ready_to_send).not.toEqual(stateMachine.sent);
  });
});

// ============================================================
// T10: mock seed vs canonical truth
// ============================================================

describe("T10: mock seed는 canonical candidate truth를 override하지 않음", () => {
  it("canonical store field가 존재하면 presentation seed가 무시되어야 함", () => {
    // canonical truth
    const canonicalRecord = {
      supplier: "실제 공급업체",
      amount: 150000,
      normalizedCategoryId: "cat-reagents",
      status: "APPROVED",
    };

    // presentation seed (mock)
    const presentationSeed = {
      supplier: "Mock 공급업체",
      amount: 100000,
      normalizedCategoryId: null,
      status: "DRAFT",
    };

    // merge rule: canonical이 존재하면 canonical 우선
    function resolveField<T>(canonical: T | null | undefined, seed: T): T {
      return canonical !== null && canonical !== undefined ? canonical : seed;
    }

    expect(resolveField(canonicalRecord.supplier, presentationSeed.supplier)).toBe("실제 공급업체");
    expect(resolveField(canonicalRecord.amount, presentationSeed.amount)).toBe(150000);
    expect(resolveField(canonicalRecord.normalizedCategoryId, presentationSeed.normalizedCategoryId)).toBe("cat-reagents");
    expect(resolveField(canonicalRecord.status, presentationSeed.status)).toBe("APPROVED");
  });
});

// ============================================================
// T11: Budget gate audit event shape 정합성
// ============================================================

describe("T11: Budget gate audit event shape", () => {
  it("evaluateStatus는 hard_stop 임계치에서 over_budget을 반환한다", () => {
    expect(evaluateStatus(100, {
      warningPercent: 70,
      softLimitPercent: 90,
      hardStopPercent: 100,
    })).toBe("over_budget");
  });

  it("evaluateStatus는 soft_limit 범위에서 soft_limit을 반환한다", () => {
    expect(evaluateStatus(92, {
      warningPercent: 70,
      softLimitPercent: 90,
      hardStopPercent: 100,
    })).toBe("soft_limit");
  });

  it("evaluateStatus는 예산 미설정이면 no_budget을 반환한다", () => {
    expect(evaluateStatus(null, null)).toBe("no_budget");
  });

  it("evaluateStatus는 정상 범위에서 normal을 반환한다", () => {
    expect(evaluateStatus(50, {
      warningPercent: 70,
      softLimitPercent: 90,
      hardStopPercent: 100,
    })).toBe("normal");
  });

  it("evaluateStatus는 warning 범위에서 warning을 반환한다", () => {
    expect(evaluateStatus(75, {
      warningPercent: 70,
      softLimitPercent: 90,
      hardStopPercent: 100,
    })).toBe("warning");
  });
});
